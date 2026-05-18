import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  const pemKey = sa.private_key;
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const serviceAccountB64 = Deno.env.get("GOOGLE_SERVICE_ACCOUNT")!;
    const spreadsheetId = Deno.env.get("SPREADSHEET_ID")!;

    const token = await getGoogleToken(serviceAccountB64);

    const { type } = await req.json().catch(() => ({ type: "sales" }));

    if (type === "sales" || type === "all") {
      const today = new Date().toISOString().split("T")[0];
      const { data: sales } = await supabase
        .from("sales_headers")
        .select("sales_number, transaction_date, grand_total, payment_method, transaction_status")
        .gte("transaction_date", today)
        .is("deleted_at", null)
        .neq("transaction_status", "VOID");

      if (sales && sales.length > 0) {
        const rows = sales.map((s: Record<string, unknown>) => [
          s.sales_number,
          new Date(s.transaction_date as string).toLocaleString("id-ID"),
          s.grand_total,
          s.payment_method,
          s.transaction_status,
        ]);
        await appendToSheet(token, spreadsheetId, "Penjualan!A1", rows);
      }
    }

    if (type === "purchases" || type === "all") {
      const today = new Date().toISOString().split("T")[0];
      const { data: purchases } = await supabase
        .from("purchase_headers")
        .select("purchase_number, transaction_date, grand_total, payment_status")
        .gte("transaction_date", today)
        .is("deleted_at", null);

      if (purchases && purchases.length > 0) {
        const rows = purchases.map((p: Record<string, unknown>) => [
          p.purchase_number,
          p.transaction_date,
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
