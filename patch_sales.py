with open('src/routes/_authenticated/sales.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'current_retail_price, current_wholesale_price, product_units(id, unit_name, conversion_qty, retail_price, wholesale_price)")',
    'current_buy_price, current_retail_price, current_wholesale_price, product_units(id, unit_name, conversion_qty, retail_price, wholesale_price)")'
)
content = content.replace(
    'selling_price: number; discount',
    'selling_price: number; buy_price?: number; discount'
)
content = content.replace(
    'qty: 1, selling_price: sp }];',
    'qty: 1, selling_price: sp, buy_price: Number((p as any).current_buy_price ?? 0) }];'
)
content = content.replace(
    'selling_price: l.selling_price, total: l.qty * l.selling_price })',
    'selling_price: l.selling_price, buy_price: l.buy_price ?? 0, total: l.qty * l.selling_price })'
)

with open('src/routes/_authenticated/sales.tsx', 'w') as f:
    f.write(content)
print('OK')
