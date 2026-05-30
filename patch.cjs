const fs = require('fs');
let content = fs.readFileSync('src/routes/_authenticated/purchases.tsx', 'utf8');
const old =       // Update harga produk
      for (const l of editLines) {
        await supabase.from("products").update({ current_buy_price: l.buy_price, current_retail_price: l.retail_price, current_wholesale_price: l.wholesale_price } as never).eq("id", l.product_id);
      }
    },;
const neu =       // Update harga produk
      for (const l of editLines) {
        await supabase.from("products").update({ current_buy_price: l.buy_price, current_retail_price: l.retail_price, current_wholesale_price: l.wholesale_price } as never).eq("id", l.product_id);
      }
      // Update supplier_debts jika ada
      const { data: debtData } = await supabase.from("supplier_debts").select("id, paid_amount").eq("purchase_id", pid).single();
      if (debtData) {
        const paidSoFar = Number(debtData.paid_amount);
        const newRemaining = editGrandTotal - paidSoFar;
        const newStatus = newRemaining <= 0 ? "LUNAS" : "BELUM_LUNAS";
        await supabase.from("supplier_debts").update({ amount: editGrandTotal, remaining: newRemaining, status: newStatus } as never).eq("id", debtData.id);
      }
    },;
if (content.includes(old)) { fs.writeFileSync('src/routes/_authenticated/purchases.tsx', content.replace(old, neu)); console.log('OK'); } else { console.log('GAGAL'); }
