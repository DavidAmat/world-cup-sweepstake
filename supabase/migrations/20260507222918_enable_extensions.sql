-- Enable extensions used across the project.
-- pgcrypto: provides gen_random_uuid() for primary keys.
-- citext:   case-insensitive text type, useful for matching team/player
--           names when importing seed data.
create extension if not exists pgcrypto;
create extension if not exists citext;
