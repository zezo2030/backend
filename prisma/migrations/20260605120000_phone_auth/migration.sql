-- Phone + password sign-in. Phone-only accounts have no email, so email
-- becomes optional. A nullable UNIQUE column in PostgreSQL still permits many
-- NULL rows, so the existing "users_email_key" unique index keeps working for
-- email accounts while phone accounts leave it NULL.

-- AlterTable: email no longer required
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
