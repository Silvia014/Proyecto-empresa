# CONTEXT — Brasaland

This document consolidates the company context and the operational data-analysis brief for the BRASALAND project.

---

## Company overview

Brasaland is a grilled food restaurant chain founded in Medellín, Colombia, and now operating 14 locations across Colombia and Florida, United States. The brand is built around consistent food quality, warm service, and fast kitchen execution. That consistency is difficult to maintain as the business grows across multiple countries, operating teams, and restaurant locations.

The company is led by Mariana Restrepo, CEO, who is working to build the digital systems that allow Brasaland to scale without losing the operational identity that made it successful.

### Core business areas

- Restaurant operations
- Procurement and supplier management
- Marketing and digital experience
- People and culture / HR
- Training and quality standards
- Technology and digital operations
- Executive reporting and strategic control

### Key leadership

- Mariana Restrepo — CEO
- Nicolás Park — CTO
- Felipe Guerrero — Operations Director
- Lucía Fernández — Procurement / Suppliers
- Camila Ospina — Marketing and Digital Experience
- Ashley Turner — People and Culture
- Jake Morrison — Training and Quality Standards

---

## Business challenges

Brasaland currently runs on fragmented systems: a static web presence, legacy tools, separate POS systems by country, and spreadsheet-driven management. This makes it hard to answer basic operational questions such as:

- What is selling by location in real time?
- Which local branches are at risk of ingredient shortages?
- How many customers are active in the loyalty program?
- Which suppliers are increasing prices across regions?
- How do staff turnover and attendance vary by market?

The company needs a more modern operating layer to support expansion without losing accuracy, visibility, and speed.

---

## Digital initiative

Brasaland Digital is the internal team tasked with building the systems and automations required for modern operations. The roadmap includes:

- a public-facing restaurant website
- online ordering and reservation workflows
- customer loyalty management
- internal CRM / backoffice tools
- centralized operational dashboards
- AI-assisted reporting and query interfaces
- supplier and inventory management tooling

The project is meant to modernize the business without removing the personality and service culture of the brand.

---

## CSV / incident reporting analysis brief

The operations team tracks incidents across all restaurant locations, including equipment failures, food quality issues, supply problems, customer complaints, and staff-related issues. These incidents are currently logged in spreadsheets, and the CSV file provided to the project represents a one-month dataset across all 14 branches.

### Data file

- File: `incidents-brasaland.csv`
- Encoding: UTF-8
- Separator: comma `,`
- Header row: yes

### CSV schema

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `incident_id` | string | Yes | Format `BRS-XXXXXX` |
| `date` | string | Yes | Format `YYYY-MM-DD` |
| `location_id` | string | Yes | One of `COL-01` to `COL-10`, `FLA-01` to `FLA-04` |
| `category` | string | Yes | One of the valid categories below |
| `description` | string | Yes | Minimum 5 characters |
| `status` | string | Yes | `OPEN`, `CLOSED`, or `DISCARDED` |
| `customer_id` | string | Optional | Format `CLI-XXXXXX` |
| `satisfaction_score` | integer | Conditional | Required when `status = CLOSED`; integer 1–5 |
| `reporter_id` | string | Yes | Format `MGR-XX` |

### Valid incident categories

- `CUSTOMER_COMPLAINT`
- `EQUIPMENT`
- `SUPPLY`
- `FOOD_QUALITY`
- `STAFF`

### Invalid-record rules

A record is invalid if any of the following apply:

- missing or invalid `location_id`
- missing or invalid `category`
- empty or too-short `description`
- missing `reporter_id`
- `status = CLOSED` with no `satisfaction_score`
- `satisfaction_score` is outside the range 1 to 5

The analytics script should report how many records fall into each rule type.

---

## Dataset summary expectations

The provided file includes 100 records. The expected results are:

### Valid vs invalid

- Total rows: 100
- Valid records: 96
- Invalid records: 4

### Invalid-record breakdown

| Rule triggered | Count |
| --- | ---: |
| Missing `location_id` | 1 |
| Missing or invalid `category` | 1 |
| Empty description | 1 |
| `status = CLOSED` with no `satisfaction_score` | 1 |

### Breakdown by category

| Category | Count |
| --- | ---: |
| `CUSTOMER_COMPLAINT` | 29 |
| `EQUIPMENT` | 17 |
| `SUPPLY` | 22 |
| `FOOD_QUALITY` | 19 |
| `STAFF` | 9 |

### Breakdown by status

| Status | Count |
| --- | ---: |
| `OPEN` | 32 |
| `CLOSED` | 50 |
| `DISCARDED` | 14 |

### Satisfaction index

For the 50 closed cases:

| Score | Count |
| --- | ---: |
| 1 | 4 |
| 2 | 6 |
| 3 | 12 |
| 4 | 19 |
| 5 | 9 |

Average score: 3.46 / 5.00

---

## Expected script output

When the project script is run against the provided CSV, the console output should include these values:

```text
============================================================
  BRASALAND — INCIDENT REPORT ANALYSIS
  Source file: incidents-brasaland.csv
============================================================

TOTAL RECORDS IN FILE .......... 100
  ├─ Valid records ................ 96
  └─ Invalid / incomplete .......... 4

INVALID RECORDS BREAKDOWN
  ├─ Missing location_id ........... 1
  ├─ Invalid or missing category ... 1
  ├─ Empty description ............. 1
  └─ Closed case, no score ......... 1

BREAKDOWN BY CATEGORY (valid records)
  ├─ CUSTOMER_COMPLAINT ........... 29  (30.2%)
  ├─ EQUIPMENT .................... 17  (17.7%)
  ├─ SUPPLY ....................... 22  (22.9%)
  ├─ FOOD_QUALITY ................. 19  (19.8%)
  └─ STAFF ......................... 9   (9.4%)

BREAKDOWN BY STATUS (valid records)
  ├─ OPEN ......................... 32  (33.3%)
  ├─ CLOSED ....................... 50  (52.1%)
  └─ DISCARDED .................... 14  (14.6%)

SATISFACTION INDEX (closed cases)
  Scored cases: 50 of 50
  Average score: 3.46 / 5.00
  ├─ Score 1 (Very dissatisfied) ... 4
  ├─ Score 2 (Dissatisfied) ........ 6
  ├─ Score 3 (Neutral) ............ 12
  ├─ Score 4 (Satisfied) .......... 19
  └─ Score 5 (Very satisfied) ...... 9

============================================================
Export results to CSV? [y / n]:
```

---

## Repository note

This file consolidates the earlier root context documents so the project has a single canonical source for the business context and implementation brief. The root workspace should use this file as the primary context reference.
