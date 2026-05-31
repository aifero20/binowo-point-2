import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getGoogleTokenDirect(clientEmail: string, privateKeyPem: string): Promise<string> {
  const toB64Url = (str: string) => btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const now = Math.floor(Date.now() / 1000);
  const header = toB64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = toB64Url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));

  const pemKey = privateKeyPem.replace(/\\n/g, "\n");
  const pemContents = pemKey
    .split("-----BEGIN PRIVATE KEY-----").join("")
    .split("-----END PRIVATE KEY-----").join("")
    .split("\n").join("");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const base64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sigB64 = base64url(signature);
  const jwt = `${signingInput}.${sigB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  console.log("Token exchange:", JSON.stringify(tokenData));
  return tokenData.access_token;
}

async function getGoogleToken(serviceAccountB64: string): Promise<string> {
  const sa = JSON.parse(atob(serviceAccountB64));
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));

  const pemKey = sa.private_key.replace(/\\n/g, "\n");
  const pemContents = pemKey.split("-----BEGIN PRIVATE KEY-----").join("").split("-----END PRIVATE KEY-----").join("").split("\n").join("");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  console.log("Token exchange:", JSON.stringify(tokenData));
  return tokenData.access_token;
}

async function appendToSheet(token: string, spreadsheetId: string, range: string, values: unknown[][]) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    console.log("Using key prefix:", serviceRoleKey?.substring(0,20));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL")!;
    const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY")!;
    const spreadsheetId = Deno.env.get("SPREADSHEET_ID")!;

    const token = await getGoogleTokenDirect(clientEmail, privateKey);
    console.log("Token ok:", !!token);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch(e) { console.log("Body parse error:", e); }
    console.log("Body keys:", Object.keys(body).join(","));
    const type = isWebhook ? "sales" : ((body.type as string) ?? "all");

    if (type === "sales" || type === "all") {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      // Ambil semua users untuk mapping cashier_id -> full_name
      const { data: usersData } = await supabase.from("users").select("id, full_name").is("deleted_at", null);
      const userMap: Record<string, string> = {};
      (usersData ?? []).forEach((u: Record<string, unknown>) => { userMap[u.id as string] = u.full_name as string; });
      const { data: sales, error: salesError } = await supabase
        .from("sales_headers")
        .select(`sales_number, transaction_date, created_at, subtotal, discount, grand_total, payment_method, payment_amount, change_amount, transaction_status, cashier_id, customer:customer_id(customer_name), sales_details(qty, unit_name, selling_price, product:product_id(product_name))`)
        .order("created_at", { ascending: false });
      console.log("Sales fetched:", sales?.length ?? 0, "error:", JSON.stringify(salesError));
      if (sales && sales.length > 0) {
        const rows: unknown[][] = [];
        rows.push(["No. Transaksi","Tanggal","Jam","Kasir","Customer","Nama Produk","Qty","Satuan","Harga Satuan","Total Item","Diskon Header (%)","Grand Total","Metode Bayar","Dibayar","Kembalian","Status"]);
        for (const s of sales as Record<string, unknown>[]) {
          const dt = new Date((s.transaction_date ?? s.created_at) as string);
          const wib = new Date(dt.getTime() + 7 * 60 * 60 * 1000);
          const tgl = wib.toISOString().split("T")[0].split("-").reverse().join("/");
          const jam = wib.toISOString().split("T")[1].substring(0, 8);
          const kasir = userMap[s.cashier_id as string] ?? (s.cashier_id as string)?.substring(0,8) ?? "-";
          const customer = (s.customer as Record<string,unknown>)?.customer_name ?? "Umum/Walk-in";
          const details = (s.sales_details as Record<string,unknown>[]) ?? [];
          const subtotal = Number(s.subtotal ?? 0);
          const grandTotal = Number(s.grand_total ?? 0);
          const discPct = subtotal > 0 ? Math.round((1 - grandTotal/subtotal)*100) : 0;
          const itemList = details.length > 0 ? details : [null];
          itemList.forEach((d, idx) => {
            const produk = d ? ((d.product as Record<string,unknown>)?.product_name ?? "-") : "-";
            const harga = d ? Number(d.selling_price ?? 0) : 0;
            const qty = d ? Number(d.qty ?? 0) : 0;
            const satuan = d ? (d.unit_name ?? "-") : "-";
            rows.push([
              s.sales_number,
              tgl,
              jam,
              kasir,
              customer,
              produk, qty, satuan, harga, harga*qty,
              discPct,
              grandTotal,
              s.payment_method,
              s.payment_amount,
              s.change_amount,
              s.transaction_status
            ]);
          });
        }
        // Selalu overwrite dari A1
        const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Penjualan!A1?valueInputOption=RAW`, {
          method: "PUT",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ range: "Penjualan!A1", majorDimension: "ROWS", values: rows }),
        });
        const sheetResult = await updateRes.json();
        console.log("Sheet write result:", JSON.stringify(sheetResult));
      }
    }
    if (type === "purchases" || type === "all") {
      const { data: purchases } = await supabase
        .from("purchase_headers")
        .select("purchase_number, invoice_number, transaction_date, created_at, grand_total, payment_status, suppliers(supplier_name), purchase_details(qty, unit_name, buy_price, products(product_name))")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (purchases && purchases.length > 0) {
        const purchaseRows: unknown[][] = [];
        purchaseRows.push(["No. PO","No. Invoice","Tanggal","Supplier","Nama Produk","Qty","Satuan","Harga Satuan","Total Item","Grand Total","Status Bayar"]);
        for (const p of purchases as Record<string, unknown>[]) {
          const dt = new Date((p.transaction_date ?? p.created_at) as string);
          const wib = new Date(dt.getTime() + 7 * 60 * 60 * 1000);
          const tgl = wib.toISOString().split("T")[0].split("-").reverse().join("/");
          const supplier = (p.suppliers as Record<string,unknown>)?.supplier_name ?? "-";
          const details = (p.purchase_details as Record<string,unknown>[]) ?? [];
          const itemList = details.length > 0 ? details : [null];
          itemList.forEach((d, idx) => {
            const produk = d ? ((d.products as Record<string,unknown>)?.product_name ?? "-") : "-";
            const qty = d ? Number(d.qty ?? 0) : 0;
            const satuan = d ? (d.unit_name ?? "-") : "-";
            const harga = d ? Number(d.buy_price ?? 0) : 0;
            purchaseRows.push([p.purchase_number, p.invoice_number ?? "-", tgl, supplier, produk, qty, satuan, harga, qty * harga, p.grand_total, p.payment_status ?? "-"]);
          });
        }
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Pembelian!A1?valueInputOption=RAW`, {
          method: "PUT",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ range: "Pembelian!A1", majorDimension: "ROWS", values: purchaseRows }),
        });
      }
    }
    if (type === "retur_pembelian" || type === "all") {
      const { data: returPembelian } = await supabase
        .from("purchase_returns")
        .select("return_number, return_date, created_at, grand_total, suppliers(supplier_name), purchase_return_details(qty, unit_name, buy_price, products(product_name))")
        .order("created_at", { ascending: false });
      if (returPembelian && returPembelian.length > 0) {
        const rpRows: unknown[][] = [];
        rpRows.push(["No. Retur","Tanggal","Jam","Supplier","Nama Produk","Qty","Satuan","Harga Satuan","Total Item","Grand Total"]);
        for (const r of returPembelian as Record<string, unknown>[]) {
          const dt = new Date((r.return_date ?? r.created_at) as string);
          const wib = new Date(dt.getTime() + 7 * 60 * 60 * 1000);
          const tgl = wib.toISOString().split("T")[0].split("-").reverse().join("/");
          const jam = wib.toISOString().split("T")[1].substring(0, 8);
          const supplier = (r.suppliers as Record<string,unknown>)?.supplier_name ?? "-";
          const details = (r.purchase_return_details as Record<string,unknown>[]) ?? [];
          const itemList = details.length > 0 ? details : [null];
          itemList.forEach((d) => {
            const produk = d ? ((d.products as Record<string,unknown>)?.product_name ?? "-") : "-";
            const qty = d ? Number(d.qty ?? 0) : 0;
            const satuan = d ? (d.unit_name ?? "-") : "-";
            const harga = d ? Number(d.buy_price ?? 0) : 0;
            rpRows.push([r.return_number, tgl, jam, supplier, produk, qty, satuan, harga, qty * harga, r.grand_total]);
          });
        }
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Retur%20Pembelian!A1?valueInputOption=RAW`, {
          method: "PUT",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ range: "Retur Pembelian!A1", majorDimension: "ROWS", values: rpRows }),
        });
      }
    }
    if (type === "retur_penjualan" || type === "all") {
      const { data: usersData2 } = await supabase.from("users").select("id, full_name").is("deleted_at", null);
      const userMap2: Record<string, string> = {};
      (usersData2 ?? []).forEach((u: Record<string, unknown>) => { userMap2[u.id as string] = u.full_name as string; });
      const { data: returPenjualan } = await supabase
        .from("sales_headers")
        .select("sales_number, created_at, grand_total, cashier_id, customer:customer_id(customer_name), sales_details(qty, unit_name, selling_price, discount, product:product_id(product_name))")
        .eq("transaction_status", "VOID")
        .eq("payment_method", "RETUR")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (returPenjualan && returPenjualan.length > 0) {
        const rsRows: unknown[][] = [];
        rsRows.push(["No. Transaksi","Tanggal","Jam","Kasir","Customer","Nama Produk","Qty","Satuan","Harga Satuan","Total Item","Diskon (%)","Grand Total"]);
        for (const r of returPenjualan as Record<string, unknown>[]) {
          const dt = new Date(r.created_at as string);
          const wib = new Date(dt.getTime() + 7 * 60 * 60 * 1000);
          const tgl = wib.toISOString().split("T")[0].split("-").reverse().join("/");
          const jam = wib.toISOString().split("T")[1].substring(0, 8);
          const kasir = userMap2[r.cashier_id as string] ?? "-";
          const customer = (r.customer as Record<string,unknown>)?.customer_name ?? "Umum/Walk-in";
          const details = (r.sales_details as Record<string,unknown>[]) ?? [];
          const grandTotal = Number(r.grand_total ?? 0);
          const itemList = details.length > 0 ? details : [null];
          itemList.forEach((d) => {
            const produk = d ? ((d.product as Record<string,unknown>)?.product_name ?? "-") : "-";
            const qty = d ? Number(d.qty ?? 0) : 0;
            const satuan = d ? (d.unit_name ?? "-") : "-";
            const harga = d ? Number(d.selling_price ?? 0) : 0;
            const disc = d ? Number(d.discount ?? 0) : 0;
            rsRows.push([r.sales_number, tgl, jam, kasir, customer, produk, qty, satuan, harga, qty * harga, disc, grandTotal]);
          });
        }
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Retur%20Penjualan!A1?valueInputOption=RAW`, {
          method: "PUT",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ range: "Retur Penjualan!A1", majorDimension: "ROWS", values: rsRows }),
        });
      }
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
