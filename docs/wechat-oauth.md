# Public RSVP WeChat name autofill

The public invitation requests the WeChat profile nickname only when opened inside WeChat. Other browsers keep the name field editable for manual entry.

## Setup

1. Enable webpage OAuth and the `snsapi_userinfo` scope for the WeChat Official Account. Add the deployed invitation site's hostname as its OAuth callback domain.
2. In Supabase Project Settings, add these Edge Function secrets:
   - `WECHAT_APP_ID`
   - `WECHAT_APP_SECRET`
3. Deploy the function:

   ```powershell
   supabase functions deploy wechat-oauth
   ```

Keep the app secret in Supabase Edge Function secrets; do not add it to the frontend `.env` file. The public RSVP continues to accept manual name entry if WeChat authorization is unavailable or declined.
