# GanatheFinance.xlsx — simple workbook schema

The V2 workbook contains **two visible sheets only**. Categories and payment-type choices are supplied by the application, not separate workbook tabs.

## Transactions

| Column | Meaning |
|---|---|
| ID | Unique transaction identifier used to prevent duplicate appends |
| Date | Transaction date |
| Type | Expense or Income |
| Description | Short merchant / transaction description |
| Category | Application category |
| Amount | Original amount, positive value |
| Currency | Original currency |
| Payment Method | Cash, card, bank transfer, wallet or other |
| Paid By | Family member who paid |
| Trip | Optional trip name/reference |
| Shared With | Optional participants for shared costs |
| Notes | Optional note |

## Trips

| Column | Meaning |
|---|---|
| ID | Unique trip identifier |
| Trip | Trip name |
| Destination | Destination or route |
| Start Date | Trip start |
| End Date | Trip end |
| Participants | Participant names separated by commas or a readable delimiter |
| Status | Active or Closed |

## Principles
- One file: `GanatheFinance.xlsx`.
- No extra Settings, Lists, Users, or technical audit tabs.
- Do not manually add formulas or alter header names; the application owns the schema.
- Keep a backup/version history in OneDrive.
- Multi-currency reports must group by currency until transaction-time FX conversion is added. Do not add unlike currencies together.
- Shared trip expenses link to a trip by trip name. Detailed split allocation and settlement are implemented in the application layer.
