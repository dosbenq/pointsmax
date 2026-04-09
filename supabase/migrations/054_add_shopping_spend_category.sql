-- Add 'shopping' to spend_category enum to match TypeScript type
ALTER TYPE spend_category ADD VALUE IF NOT EXISTS 'shopping';
