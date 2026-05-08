```bash
update public.profiles set role='admin'
 where user_id = (select id from auth.users where email = 'david1@gmail.com');
```