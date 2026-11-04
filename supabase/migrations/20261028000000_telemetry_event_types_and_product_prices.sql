-- Telemetry schema alignment for the Brasaland telemetry plan.
-- The live database has already received these changes; keep this migration
-- in version control so new environments can reproduce them.

ALTER TABLE public.telemetry_events
    DROP CONSTRAINT IF EXISTS telemetry_events_event_type_check;

ALTER TABLE public.telemetry_events
    ADD CONSTRAINT telemetry_events_event_type_check
    CHECK (event_type IN (
        'inbound_order_created',
        'outbound_order_created',
        'stock_waste_registered',
        'stock_threshold_triggered',
        'direct_stock_edit_rejected',
        'ingredient_price_variance_detected',
        'inbound_order_validation_failed',
        'outbound_order_validation_failed',
        'inventory_order_submitted',
        'inventory_flow_abandoned',
        'minimum_stock_alert_acknowledged',
        'supplier_delivery_recorded',
        'supplier_price_updated',
        'inventory_threshold_configuration_changed',
        'login_succeeded',
        'login_failed',
        'session_expired',
        'permission_denied',
        'api_request_completed',
        'api_request_failed',
        'database_operation_slow',
        'frontend_action_failed',
        'frontend_route_viewed',
        'frontend_flow_step_completed',
        'frontend_flow_abandoned',
        'telemetry_event_dropped',
        'telemetry_schema_validation_failed'
    ));

ALTER TABLE public.inventory_movements
    ADD COLUMN IF NOT EXISTS supplier_id integer,
    ADD COLUMN IF NOT EXISTS unit_cost double precision;

CREATE INDEX IF NOT EXISTS ix_inventory_movements_supplier_id
    ON public.inventory_movements (supplier_id);

CREATE INDEX IF NOT EXISTS ix_inventory_movements_item_supplier_price
    ON public.inventory_movements (item_id, supplier_id, created_at DESC)
    WHERE movement_type = 'inbound' AND unit_cost IS NOT NULL;
