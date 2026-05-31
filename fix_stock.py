with open('src/routes/_authenticated/sales.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'overStock: avail > 0 && newQty > avail',
    'overStock: newQty > avail && avail >= 0'
)

old = '      const sales_number = "SO" + Date.now();'
new_code = (
    '      // Validasi stok realtime sebelum transaksi\n'
    '      const { data: freshMovements } = await supabase\n'
    '        .from("stock_movements")\n'
    '        .select("product_id, qty_in, qty_out")\n'
    '        .eq("warehouse_id", warehouseId)\n'
    '        .in("product_id", cart.map((l) => l.product_id));\n'
    '      const freshStock: Record<string, number> = {};\n'
    '      for (const m of (freshMovements ?? []) as any[]) {\n'
    '        if (!freshStock[m.product_id]) freshStock[m.product_id] = 0;\n'
    '        freshStock[m.product_id] += Number(m.qty_in) - Number(m.qty_out);\n'
    '      }\n'
    '      const overStockItems = cart.filter((l) => {\n'
    '        const avail = freshStock[l.product_id] ?? 0;\n'
    '        return l.qty > avail;\n'
    '      });\n'
    '      if (overStockItems.length > 0) {\n'
    '        const names = overStockItems.map((l) => `${l.product_name} (stok: ${freshStock[l.product_id] ?? 0})`).join(", ");\n'
    '        throw new Error(`Stok tidak cukup: ${names}`);\n'
    '      }\n'
    '      const sales_number = "SO" + Date.now();'
)
content = content.replace(old, new_code)

with open('src/routes/_authenticated/sales.tsx', 'w') as f:
    f.write(content)
print('OK')
