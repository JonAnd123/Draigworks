"""Builds a throw-away Postgres with stubs for Supabase's auth/storage, then loads all SQL files.
Usage: python3 supabase/tests/setup_db.py && python3 supabase/tests/rls_test.py   (needs: pip install pgserver psycopg2-binary)"""
import pgserver, psycopg2, os, shutil, glob
D = "/tmp/pgtest/data"
shutil.rmtree("/tmp/pgtest", ignore_errors=True); os.makedirs("/tmp/pgtest", exist_ok=True)
srv = pgserver.get_server(D, cleanup_mode="stop")
conn = psycopg2.connect(srv.get_uri()); conn.autocommit = True
cur = conn.cursor()
here = os.path.dirname(os.path.abspath(__file__)); sup = os.path.dirname(here)
files = [os.path.join(here, "stubs.sql")] + sorted(glob.glob(os.path.join(sup, "0*.sql")))
for f in files:
    cur.execute(open(f, encoding="utf-8").read())
    print("loaded", os.path.basename(f))
