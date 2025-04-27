import { Kysely, sql } from 'kysely';

/**
 * Creates a properly functioning UUID v7 function in PostgreSQL
 * 
 * @param db {Kysely<any>}
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Create extension for UUID generation
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);
  
  // Create custom UUID v7 function
  await sql`
	CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid
	AS $$
	  -- Replace the first 48 bits of a uuidv4 with the current
	  -- number of milliseconds since 1970-01-01 UTC
	  -- and set the "ver" field to 7 by setting additional bits
	  select encode(
	    set_bit(
	      set_bit(
	        overlay(uuid_send(gen_random_uuid()) placing
		  substring(int8send((extract(epoch from clock_timestamp())*1000)::bigint) from 3)
		  from 1 for 6),
		52, 1),
	      53, 1), 'hex')::uuid;
	$$ LANGUAGE sql volatile;
  `.execute(db);
}

/**
 * Removes the UUID v7 function
 * 
 * @param db {Kysely<any>}
 */
export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP FUNCTION IF EXISTS uuid_generate_v7()`.execute(db);
}