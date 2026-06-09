-- Add the new "commercial" property type. Kept in its own migration so the new
-- enum value is committed before any later migration could reference it
-- (PostgreSQL forbids using a freshly added enum value in the same transaction).
ALTER TYPE "PropertyType" ADD VALUE 'commercial';
