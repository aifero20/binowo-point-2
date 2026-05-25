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

    const { type } = await req.json().catch(() => ({ type: "sales" }));

    if (type === "sales" || type === "all") {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const { data: sales, error: salesError } = await supabase
        .from("sales_headers")
        .select(`sales_number, transaction_date, created_at, subtotal, discount, grand_total, payment_method, payment_amount, change_amount, transaction_status, cashier_id, customer:customer_id(customer_name), sales_details(qty, unit_name, selling_price, product:product_id(product_name))`)
        .gte("created_at", yesterday)
        .is("deleted_at", null)
        .neq("transaction_status", "VOID");
      console.log("Sales fetched:", sales?.length ?? 0, "error:", JSON.stringify(salesError));
      if (sales && sales.length > 0) {
        const rows: unknown[][] = [];
        rows.push(["No. Transaksi","Tanggal","Jam","Kasir","Customer","Nama Produk","Qty","Satuan","Harga Satuan","Total Item","Diskon Header (%)","Grand Total","Metode Bayar","Dibayar","Kembalian","Status"]);
        for (const s of sales as Record<string, unknown>[]) {
          const dt = new Date((s.transaction_date ?? s.created_at) as string);
          const tgl = dt.toLocaleDateString("id-ID");
          const jam = dt.toLocaleTimeString("id-ID");
          const kasir = (s.cashier_id as string)?.substring(0,8) ?? "-";
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
              idx===0 ? s.sales_number : "",
              idx===0 ? tgl : "",
              idx===0 ? jam : "",
              idx===0 ? kasir : "",
              idx===0 ? customer : "",
              produk, qty, satuan, harga, harga*qty,
              idx===0 ? discPct : "",
              idx===0 ? grandTotal : "",
              idx===0 ? s.payment_method : "",
              idx===0 ? s.payment_amount : "",
              idx===0 ? s.change_amount : "",
              idx===0 ? s.transaction_status : ""
            ]);
          });
        }
        const sheetResult = await appendToSheet(token, spreadsheetId, "Penjualan!A1", rows);
        console.log("Sheet write result:", JSON.stringify(sheetResult));
      }
    }
    if (type === "purchases" || type === "all") {
      const today = new Date().toISOString().split("T")[0];
      const { data: purchases } = await supabase
        .from("purchase_headers")
        .select("purchase_number, transaction_date, created_at, grand_total, payment_status")
        .gte("created_at", today)
        .is("deleted_at", null);

      if (purchases && purchases.length > 0) {
        const rows = purchases.map((p: Record<string, unknown>) => [
          p.purchase_number,
          new Date((p.transaction_date ?? p.created_at) as string).toLocaleString("id-ID"),
          p.grand_total,
          p.payment_status,
        ]);
        await appendToSheet(token, spreadsheetId, "Pembelian!A1", rows);
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
