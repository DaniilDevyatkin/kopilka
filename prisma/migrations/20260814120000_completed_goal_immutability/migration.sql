CREATE OR REPLACE FUNCTION "enforce_completed_goal_immutability"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'COMPLETED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'completed goal % is immutable', OLD."id"
      USING ERRCODE = '23514',
            CONSTRAINT = 'goals_completed_immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "goals_completed_immutable_trigger"
BEFORE UPDATE ON "goals"
FOR EACH ROW
EXECUTE FUNCTION "enforce_completed_goal_immutability"();
