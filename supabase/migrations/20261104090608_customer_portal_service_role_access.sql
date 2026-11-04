-- The account API uses the service role to read the signed-in customer's
-- profile, Brasapoints ledger, order history and reservations. Profile updates
-- are scoped by authUserId in the server handler. No browser role is granted.
GRANT SELECT, UPDATE ON TABLE public."Customer" TO service_role;
GRANT SELECT ON TABLE public."BrasapointsAccount", public."BrasapointsTransaction", public."Order", public."OrderItem" TO service_role;
