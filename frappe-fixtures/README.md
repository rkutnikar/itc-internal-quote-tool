# Frappe setup for ITC Quote Tool

Works with any existing Frappe/ERPNext v14+ site. Nothing here modifies existing data.

## 1. Create the API service user

1. Desk → **Users** → New. Email e.g. `quote-tool@yourco.com`, User Type **System User**.
2. Desk → **Role** → New → name it `Quote Tool API`.
3. Assign the role to the user.
4. Open the user → **Settings tab → API Access → Generate Keys**. Copy the **API Key** and the **API Secret** (secret is shown only once).

## 2. Grant permissions

Desk → **Role Permission Manager**, for role `Quote Tool API`:

| Doctype | Read | Write | Create |
|---|---|---|---|
| Employee | ✅ | – | – |
| Customer | ✅ | – | – |
| Supplier | ✅ | – | – |
| Consultant Quote (after step 4) | ✅ | ✅ | ✅ |
| File | ✅ | ✅ | ✅ |

Note: Employee is HR-sensitive. If Employee has User Permission restrictions, exempt this role or the list will come back empty.

## 3. Custom fields

**Option A — bench (recommended):**

```bash
bench --site yoursite.local import-doc /path/to/frappe-fixtures/custom_fields.json
```

**Option B — manual (Desk → Customize Form):**

| Doctype | Fieldname | Type | Options |
|---|---|---|---|
| Customer | `custom_priority` | Select | `P1 - Strategic` / `P2 - Preferred` / `P3 - Standard`, default P3 |
| Employee | `custom_ctc_annual` | Currency | |
| Supplier | `custom_is_consultant` | Check | |
| Supplier | `custom_monthly_rate` | Currency | |

Already store CTC or priority somewhere else? Keep your fields and change the fieldnames in the webapp: **Settings → Field Mapping**.

## 4. Consultant Quote doctype

**Option A — bench:**

```bash
bench --site yoursite.local import-doc /path/to/frappe-fixtures/consultant_quote.json
bench --site yoursite.local migrate
```

**Option B — manual:** Desk → **DocType** → New → name `Consultant Quote`, module `Custom`, check *Custom*, then add the fields listed in `consultant_quote.json` (field_order gives the layout). Add the permission rows from the JSON.

## 5. Verify

In the webapp: **Settings → Frappe Connection** → enter site URL + API key/secret → **Save** → **Run Connection Test**. Every check reports pass/fail with a specific fix. All green = done.
