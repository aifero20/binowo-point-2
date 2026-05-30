const fs = require("fs");
let c = fs.readFileSync("src/routes/_authenticated/purchases.tsx", "utf8");
const target = "      }\n    },\n    onSuccess: () => { toast.success(\"Pembelian diperbarui\")";
const replacement = `      }
      // Update supplier_debts jika ada
      const { data: debtData } = await supabase.from("supplier_debts").select("id, paid_amount").eq("purchase_id", pid).single();
      if (debtData) {
        const paidSoFar = Number(debtData.paid_amount);
        const newRemaining = editGrandTotal - paidSoFar;
        const newStatus = newRemaining <= 0 ? "LUNAS" : "BELUM_LUNAS";
        await supabase.from("supplier_debts").update({ amount: editGrandTotal, remaining: newRemaining, status: newStatus } as never).eq("id", debtData.id);
      }
    },
    onSuccess: () => { toast.success("Pembelian diperbarui")`;
if (c.includes(target)) { fs.writeFileSync("src/routes/_authenticated/purchases.tsx", c.replace(target, replacement)); console.log("OK"); } else { console.log("GAGAL"); }