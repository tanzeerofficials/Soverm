ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE insights DROP CONSTRAINT IF EXISTS insights_user_id_fkey;

ALTER TABLE users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE users ALTER COLUMN id TYPE TEXT USING id::text;

ALTER TABLE accounts ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE transactions ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE insights ALTER COLUMN user_id TYPE TEXT USING user_id::text;

ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE transactions ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE insights ADD CONSTRAINT insights_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
