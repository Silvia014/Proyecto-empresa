# Telemetry Plan — Brasaland

**Status:** Design proposal for technical review.  
**Scope:** Inventory, orders, authentication, navigation, performance, errors, and telemetry pipeline health.  
**Important:** This document defines what should be captured. It does not claim that instrumentation has already been implemented.

## 1. Context and Objectives

Brasaland is a restaurant chain operating 14 locations across Colombia and Florida. Its inventory management system handles products, inbound and outbound orders, locations, and suppliers. The fundamental business constraint is that stock must never be modified directly: every valid stock change must be traceable through an inbound or outbound order.

Telemetry must give the operations team visibility into the system and support data-driven decisions, both now and in future applications and executive reports.

The objectives are to:

- Measure purchases, consumption, waste, and stockout risk by product and location.
- Detect attempts to bypass inventory rules and recurring validation failures.
- Identify abnormal ingredient price variations.
- Measure authentication activity, backoffice usage, errors, and abandoned workflows.
- Monitor API latency, failures, slow database operations, and dropped events.
- Support aggregation by location, country, and week for future reporting.
- Define consistent, secure, versioned event contracts before implementing instrumentation.

## 2. Design Principles

Every event must answer the following question:

> We capture `[event_type]` because we need to determine `[hypothesis]`, which enables us to make the decision `[specific decision]`.

The following principles apply:

1. Business events must originate from the backend when the corresponding operation has been successfully committed.
2. Every event must use a consistent name, a shared envelope, and an explicit property allowlist.
3. Mandatory metrics, additional opportunities, and features not yet implemented must be clearly distinguished.
4. Telemetry must preserve local currency: COP in Colombia and USD in Florida. Currency conversion belongs to a downstream reporting pipeline.
5. Interface language is independent of the location's country.
6. Critical inventory and security events must be captured reliably. High-volume navigation events may be aggregated or rate-limited to reduce noise.
7. Telemetry must never change the outcome of an inventory transaction or make a prohibited operation valid.

## 3. Main Entities and Dimensions

| Entity or dimension | Purpose in telemetry |
|---|---|
| `Product` | Identify ingredients or supplies, category, quantity, and unit. |
| `InboundOrder` | Measure received goods, supplier, cost, and quantities. |
| `OutboundOrder` | Measure consumption and traceable stock removals. |
| `location` | Segment metrics by restaurant, city, and country. |
| `supplier` | Analyse purchasing, costs, deliveries, and price variations. |
| `userId` | Correlate authenticated actions through a pseudonymous internal identifier, not a person's name. |
| `sessionId` | Link navigation events within a session. |
| `requestId` | Correlate frontend events, API requests, and backend logs. |
| `country` | Location country code: `CO` or `US`. |
| `currency` | Monetary unit: `COP` or `USD`. |
| `language` | Interface language, independent of `country`. |

## 4. Mandatory Business Event Catalogue

The following six events are mandatory according to the Brasaland briefing. They must be captured and stored end-to-end during the telemetry project.

| `event_type` | When it fires | Hypothesis and decision enabled | Main event-specific properties | Processing |
|---|---|---|---|---|
| `inbound_order_created` | A supplier delivery is successfully received and recorded at a location. | Consolidate purchasing quantities and costs by location and supplier to negotiate prices and improve replenishment decisions. | `location_id`, `country`, `product_id`, `product_category`, `quantity`, `unit`, `currency`, `supplier_id`, `order_id`, `unit_cost`, `total_cost`. | Stream for operational visibility; daily and weekly batch aggregation for purchasing analysis. |
| `outbound_order_created` | An outbound order for ingredient consumption is successfully recorded. | Identify the ingredients consumed most frequently and their consumption rates by location to improve replenishment suggestions. | All mandatory inventory properties (`location_id`, `country`, `product_id`, `product_category`, `quantity`, `unit`, `currency`), plus `order_id` and `reason`. | Stream for operational stock visibility; batch for trends. |
| `stock_waste_registered` | Inventory waste is recorded. | Identify products, causes, and locations with high losses to prioritise waste audits. | All mandatory inventory properties (`location_id`, `country`, `product_id`, `product_category`, `quantity`, `unit`, `currency`), plus `reason` and `order_id` (use `null` when no order can be associated). | Stream for relevant operational events; batch for analysis. |
| `stock_threshold_triggered` | A product's stock falls below its configured minimum threshold. | Detect stockout risk and adjust minimum thresholds or replenishment frequency. | All mandatory inventory properties (`location_id`, `country`, `product_id`, `product_category`, `quantity` as current stock, `unit`, `currency`), plus `threshold_quantity`. | Stream, because action may be urgent. |
| `direct_stock_edit_rejected` | The system rejects an attempt to modify stock directly. | Detect attempts to bypass traceability controls and reinforce permissions or training. | All mandatory inventory properties (`location_id`, `country`, `product_id`, `product_category`, `quantity` as the attempted quantity, `unit`, `currency`), plus `rejection_code` and `source`. | Stream for audit visibility and batch aggregation for trends. |
| `ingredient_price_variance_detected` | The unit cost of an inbound ingredient exceeds a configured threshold against a comparable historical price for that product and supplier. | Detect abnormal price increases so Procurement can review or renegotiate supplier terms. | All mandatory inventory properties (`location_id`, `country`, `product_id`, `product_category`, `quantity` received, `unit`, `currency`), plus `supplier_id`, `current_unit_cost`, `reference_unit_cost`, `variance_percent`, and `threshold_percent`. | Stream when the threshold is breached; batch for price trends. |

### 4.1. Mandatory Inventory Properties

As specified by the Brasaland briefing, **all six mandatory inventory events must include every field listed below**, even when a field is not the event's primary analytical measure. The event-specific payload must also include the additional fields listed in the table above:

- `location_id`
- `country`: `CO` or `US`
- `product_id`
- `product_category`
- `quantity`
- `unit`
- `currency`: `COP` or `USD`

The field `product_id` must be populated for `direct_stock_edit_rejected` using the product targeted by the attempted change; it must not be omitted or set to `null`. For `stock_waste_registered`, include the `order_id` key and use `null` when no order can be associated. In addition, `outbound_order_created` and `stock_waste_registered` must include `reason`.

For an outbound order representing kitchen consumption, use `reason = consumption`. For recorded waste, restrict the reason to:

- `expired`
- `kitchen_error`
- `theft_suspected`

Inventory event properties must not contain employee names or customer data. Such personal information is unnecessary for product- and location-level business analysis.

## 5. Additional Catalogue: Business and Operations

The following events extend the mandatory metrics. They are design proposals and must not be described as implemented until instrumentation and testing are complete.

| `event_type` | Hypothesis and specific decision | Main allowed properties | Processing |
|---|---|---|---|
| `inbound_order_validation_failed` | Inbound validation failures cluster around specific fields or products; improve validation rules, messages, or training. | `location_id`, `country`, `product_id`, `validation_code`, `field_name`, `source`. | Batch, with an alert if operations are blocked. |
| `outbound_order_validation_failed` | Rejections relate to invalid quantities or insufficient stock; review UX and business rules. | `location_id`, `country`, `product_id`, `validation_code`, `requested_quantity`, `available_quantity`, `unit`. | Batch and stream for critical situations. |
| `inventory_order_submitted` | There is a gap between starting and confirming an order; simplify the workflow. | `order_kind`, `location_id`, `country`, `source`. | Daily batch. |
| `inventory_flow_abandoned` | An order remains incomplete; investigate friction or interruptions. | `flow_name`, `last_step`, `elapsed_seconds`, `source`. | Hourly or daily batch. |
| `minimum_stock_alert_acknowledged` | Alerts are not acknowledged quickly enough; improve ownership and escalation. | `location_id`, `country`, `product_id`, `alert_age_seconds`, `acknowledgement_channel`. | Stream. |
| `supplier_delivery_recorded` | Delays or incomplete deliveries recur for particular suppliers or locations; review supplier agreements. | `location_id`, `country`, `supplier_id`, `order_id`, `expected_at`, `received_at`, `delivery_status`. | Daily batch; stream for critical delivery issues. |
| `supplier_price_updated` | Price history is needed to compare supplier unit costs and support negotiations. | `supplier_id`, `product_id`, `country`, `currency`, `previous_unit_cost`, `new_unit_cost`, `effective_at`. | Daily batch. |
| `inventory_threshold_configuration_changed` | Changes to minimum stock settings may alter alert frequency; review configuration decisions. | `location_id`, `country`, `product_id`, `old_threshold`, `new_threshold`, `unit`, `change_source`. | Batch; stream when the operational impact is urgent. |

## 6. Additional Catalogue: Authentication and Security

| `event_type` | Hypothesis and specific decision | Main allowed properties | Processing |
|---|---|---|---|
| `login_succeeded` | Measure authentication availability and adoption to improve support. | `auth_method`, `client_type`, `outcome`. | Daily batch. |
| `login_failed` | Identify recurring login problems or suspicious access patterns; improve recovery and protection. | `failure_code`, `auth_method`, `client_type`, `attempt_bucket`. Never capture credentials. | Stream for anomalies; daily batch for trends. |
| `session_expired` | Session expiry interrupts tasks; review session lifetime and renewal behaviour. | `session_age_seconds`, `client_type`, `route_group`, `expiry_reason`. | Batch, with an alert for sudden increases. |
| `permission_denied` | Permission failures cluster around specific actions; review roles and training. | `action_name`, `resource_type`, `reason_code`, `client_type`. | Stream for critical actions and batch for trends. |

Security events must use normalised failure codes. Passwords, tokens, cookies, and authorization headers must never be recorded.

## 7. Additional Catalogue: Performance and Technical Errors

| `event_type` | Hypothesis and specific decision | Main allowed properties | Processing |
|---|---|---|---|
| `api_request_completed` | Latency varies by route and status; prioritise optimisations where they have the greatest impact. | `route_template`, `method`, `status_code`, `duration_ms`, `response_size_bucket`, `client_type`. | Aggregated metrics in stream or near-real-time; detailed analysis in batch. |
| `api_request_failed` | Certain endpoints or dependencies produce recurring failures; investigate regressions and service problems. | `route_template`, `method`, `status_code`, `error_code`, `dependency`. | Stream for 5xx errors and critical routes; batch for trends. |
| `database_operation_slow` | Slow data operations affect inventory workflows; optimise queries or indexes. | `operation_name`, `duration_ms`, `table_group`, `result_count_bucket`. | Batch; stream when a critical threshold is exceeded. |
| `frontend_action_failed` | UI failures prevent users from completing actions; improve interactions and validation. | `action_name`, `route_group`, `error_code`, `client_type`. | Batch; stream for critical workflows. |

## 8. Additional Catalogue: Navigation and Workflow Abandonment

| `event_type` | Hypothesis and specific decision | Main allowed properties | Processing |
|---|---|---|---|
| `frontend_route_viewed` | Identify the most and least used sections; prioritise UX and training. | `route_group`, `client_type`, `language`, `entry_source`. | Daily batch. |
| `frontend_flow_step_completed` | Identify steps where users drop out; simplify the workflow. | `flow_name`, `step_name`, `step_index`, `client_type`. | Daily batch. |
| `frontend_flow_abandoned` | Measure abandonment without capturing form content; reduce friction. | `flow_name`, `last_step`, `elapsed_seconds`, `client_type`. | Hourly or daily batch. |

Abandonment must be defined through an explicit workflow rule, such as a draft remaining incomplete for 30 minutes. This is an initial proposal and must be validated with Operations before implementation.

## 9. Additional Catalogue: Telemetry Pipeline Health

| `event_type` | Hypothesis and specific decision | Main allowed properties | Processing |
|---|---|---|---|
| `telemetry_event_dropped` | Events are lost in a queue, transport, or storage layer; improve pipeline reliability. | `reason_code`, `event_type`, `pipeline_stage`, `dropped_count`. | Aggregated stream metric. |
| `telemetry_schema_validation_failed` | Invalid or incompatible events are received; correct the emitter or schema. | `event_type`, `schema_version`, `validation_code`, `source`. | Batch, with an alert if the rate increases significantly. |

## 10. Standard Event Envelope

Every business, UI, and system event must use the same envelope:

| Field | Conceptual type | Rule |
|---|---|---|
| `eventId` | UUID | Unique event identifier, generated at the emitter. |
| `timestamp` | ISO 8601 datetime | UTC date and time, for example `2026-10-26T17:00:00.000Z`. |
| `sessionId` | String or `null` | Random session identifier; `null` for processes without a user session. |
| `userId` | String or `null` | Pseudonymous internal ID, never a name or email address. |
| `event_type` | String | Consistent `entity_action` taxonomy, such as `outbound_order_created`. |
| `schemaVersion` | String | Semantic schema version, initially `1.0.0`. |
| `requestId` | String or `null` | Correlates frontend, API request, and logs; `null` for processes without a request. |
| `properties` | Object | Event-specific payload validated against a closed allowlist. |

### Correlation and deduplication

- The backend must generate or validate `requestId` and propagate it to related logs and events.
- A client-provided correlation ID must never bypass authentication or authorisation controls.
- Consumers must deduplicate events by `eventId`.
- Order events should also retain the business `order_id`.
- Business events must not be reported as successful by the frontend before the backend confirms the transaction.

## 11. Batch, Stream, Throttling, and Debouncing

Processing is selected according to business urgency.

### Stream: seconds

Use stream processing when delays could lead to incorrect operational decisions or significant incidents:

- Stock falling below a minimum threshold.
- Confirmed inventory orders when immediate stock visibility matters.
- Rejected attempts to edit stock directly.
- Abnormal ingredient price variations above the configured threshold.
- Critical API errors and suspicious authentication patterns.
- Significant telemetry event loss.

### Batch: hourly, daily, or weekly

Use batch processing for trends, comparisons, and decisions that do not require immediate action:

- Ingredient consumption and waste by product and location.
- Routes viewed and workflow steps completed.
- Order abandonment and validation trends.
- Supplier price history and delivery performance.
- Aggregated authentication activity.
- API latency percentiles such as p50, p95, and p99.

### Throttling and debouncing

- For `frontend_route_viewed`, record at most one view per `sessionId + route_group` within 30 seconds. An aggregated repeat counter may be retained.
- Do not debounce or sample the six mandatory metrics or critical inventory and security events.
- For high volumes of successful requests, prefer aggregated histograms and counters. If sampling becomes necessary, document the sampling rate and version.
- Never silently drop events when a queue is full. Trigger an alert and record event loss through pipeline-health metrics.

## 12. Privacy, Sanitisation, and Retention

### Data that must never be captured

- Passwords, tokens, cookies, API keys, and authorization headers.
- Emails, phone numbers, employee names, and customer information in business event properties.
- Payment data.
- Complete request or response bodies.
- SQL statements with parameters, URLs with query strings, or unsanitised free-text errors containing sensitive information.
- Form contents, comments, or messages that are not required by the telemetry hypothesis.

Use normalised error codes, pseudonymous internal IDs, and property allowlists. Any additional security data, such as IP addresses, requires explicit approval, restricted access, and limited retention. Such data must not be included in business reports.

### Proposed retention policy

The following periods are proposals for review by Technology and privacy stakeholders, not an approved policy.

| Data category | Proposed retention | Justification |
|---|---|---|
| Detailed security events | 30 days | Investigate recent suspicious access patterns. |
| Detailed technical diagnostics | 14 days | Correlate recent errors and investigate incidents. |
| Inventory events | Up to 13 months, if justified | Support seasonal and year-over-year comparisons. |
| Anonymised aggregates | Up to 24 months | Preserve historical trends without retaining detailed events indefinitely. |

The final policy must comply with applicable requirements in Colombia and Florida and with Brasaland's internal policies.

## 13. Risks and Justified Exclusions

| Risk or exclusion | Why it should be excluded and mitigation |
|---|---|
| Employee names in inventory event properties | The briefing prohibits them, and they are unnecessary for product-level or location-level analysis. Use a pseudonymous ID only when audit requirements justify it. |
| Credentials, tokens, or full payloads | High exposure risk. Use allowlists and normalised codes. |
| Every mouse or keyboard movement | Excessive volume and low business value. Record meaningful actions and workflow steps instead. |
| Unlimited repeated page-view events | Creates noise and high cardinality. Apply navigation debouncing and aggregation. |
| Currency conversion from COP to USD in telemetry | This belongs to downstream reporting. Preserve the original local currency. |
| Inferring country from interface language | They are separate dimensions. Record `language` and `country` independently. |
| Full SQL statements and query parameters | May expose sensitive data. Record operation names, table groups, and duration. |
| Business events emitted only by the UI | They can be forged or duplicated. Emit them from the backend after successful confirmation. |
| Accepting direct stock modifications outside orders | Violates the traceability requirement. Record the rejection, not an invalid stock change. |
| Events without a hypothesis or decision | Do not add them until their value and owner are defined. |

## 14. Responsibilities and Decisions

| Owner | Use of telemetry |
|---|---|
| Felipe Guerrero — Operations | Consumption, waste, minimum thresholds, stockouts, and location alerts. |
| Lucía Fernández — Procurement | Inbound orders, suppliers, costs, and price variations. |
| Jake Morrison — Training and Quality | Aggregated patterns of rejected stock edits and validation failures. |
| Nicolás Park — Technology | Event contract, schema validation, authentication, errors, performance, and pipeline health. |
| Mariana Restrepo — Executive Leadership | Weekly aggregated reporting by location, country, and local currency. Currency conversion occurs outside the telemetry layer. |

Every alert must have an owner, severity, and expected action. Business and technical thresholds must be agreed with their owners before notifications are enabled.

## 15. Acceptance Criteria for Future Implementation

The implementation will be ready for review when:

1. All six mandatory events are emitted at the authoritative transaction boundary and reach persistent storage.
2. Every event includes the complete envelope and passes schema validation.
3. Unknown event properties are rejected.
4. Direct stock edits remain prohibited and rejected attempts are recorded without exposing personal data.
5. Reporting supports aggregation by location, country, and week without currency conversion in the telemetry layer.
6. Errors, schema validation failures, and pipeline event loss are observable.
7. Retention, access control, versioning, and deduplication policies are defined.
8. JSON Schemas are validated automatically in CI.
9. Mandatory metrics are tested end-to-end, from event capture through persistence.

**Conclusion:** This plan defines which data should be captured, why it is valuable, who will make decisions using it, and how quality, privacy, and volume risks will be managed. The next phase must implement the contract and capture pipeline without violating the inventory traceability constraint.
