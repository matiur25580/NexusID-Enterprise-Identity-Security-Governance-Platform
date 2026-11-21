-- Stage tenant RLS policies without enabling them globally.
-- Application query paths must first establish transaction-local tenant context.
-- The integration suite enables FORCE ROW LEVEL SECURITY transactionally to
-- prove these policies fail closed before an activation migration is shipped.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_organization_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', true), '')
$$;

GRANT USAGE ON SCHEMA app TO PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_organization_id() TO PUBLIC;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Identity', 'Application', 'Entitlement', 'AccessRequest', 'AccessGrant',
    'CertificationCampaign', 'AuditEvent', 'PolicyRule',
    'IdentityRiskSnapshot', 'IdentityRiskAlert', 'LifecycleRequest',
    'ScimConnector', 'ScimGroup', 'ScimGroupEntitlementMapping'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("organizationId" = app.current_organization_id()) WITH CHECK ("organizationId" = app.current_organization_id())',
      table_name
    );
  END LOOP;
END
$$;

DROP POLICY IF EXISTS tenant_isolation ON "CertificationItem";
CREATE POLICY tenant_isolation ON "CertificationItem"
  USING (EXISTS (
    SELECT 1 FROM "CertificationCampaign" c
    WHERE c."id" = "CertificationItem"."campaignId"
      AND c."organizationId" = app.current_organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "CertificationCampaign" c
    WHERE c."id" = "CertificationItem"."campaignId"
      AND c."organizationId" = app.current_organization_id()
  ));

DROP POLICY IF EXISTS tenant_isolation ON "PolicyRuleVersion";
CREATE POLICY tenant_isolation ON "PolicyRuleVersion"
  USING (EXISTS (
    SELECT 1 FROM "PolicyRule" p
    WHERE p."id" = "PolicyRuleVersion"."policyRuleId"
      AND p."organizationId" = app.current_organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "PolicyRule" p
    WHERE p."id" = "PolicyRuleVersion"."policyRuleId"
      AND p."organizationId" = app.current_organization_id()
  ));

DROP POLICY IF EXISTS tenant_isolation ON "ScimGroupMember";
CREATE POLICY tenant_isolation ON "ScimGroupMember"
  USING (EXISTS (
    SELECT 1 FROM "ScimGroup" g
    WHERE g."id" = "ScimGroupMember"."groupId"
      AND g."organizationId" = app.current_organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "ScimGroup" g
    WHERE g."id" = "ScimGroupMember"."groupId"
      AND g."organizationId" = app.current_organization_id()
  ));
