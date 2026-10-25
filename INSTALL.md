# GEOINT Vinh - Giai doan 1: Intelligence Inbox (Django addon)

Day la goi **bo sung**, KHONG phai ban thay the du an GEOINT Vinh.

## Da co trong goi
- Nguon RSS/Atom cong khai, mac dinh tat; quan ly qua Django admin.
- Lenh thu thap tin, chong trung lap theo URL, gioi han kich thuoc, timeout, chan redirect, kiem tra IP dich.
- Inbox va brief JSON; ho so nghien cuu; phe duyet boi staff; nhat ky quyet dinh.
- Kiem thu Django co ban.

## Chua co
- LLM phan tich, suy luan, tham muu; tu dong hoa lich chay; giao dien Cesium moi; migration duoc tao san.
- Khong thu thap vi tri chinh xac cua co so quan su dang hoat dong.

## Cai vao du an Django hien tai
1. Sao luu du an va co so du lieu.
2. Chep thu muc `intelligence/` vao cung cap voi `atlas/`.
3. Trong `geoint_site/settings.py`, them `'intelligence',` vao `INSTALLED_APPS`.
4. Trong `geoint_site/urls.py`, them `path('api/intelligence/', include('intelligence.urls')),` vao `urlpatterns`.
5. Kich hoat virtualenv co Django va driver PostgreSQL; chay:
   - `python manage.py makemigrations intelligence` : tao migration tu model.
   - `python manage.py migrate` : tao bang trong co so du lieu da cau hinh.
   - `python manage.py test intelligence` : chay kiem thu.
   - `python manage.py collect_feeds` : thu thap nguon da bat.
6. Vao `/admin/` tao Source HTTPS, kiem tra nguon, sau do moi bat enabled.
7. API: GET `/api/intelligence/inbox/`, GET `/api/intelligence/brief/`, POST `/api/intelligence/cases/`, POST `/api/intelligence/cases/<id>/decision/`.

## Van hanh
- Can tai khoan dang nhap; POST su dung CSRF cua Django.
- `collect_feeds` chay thu cong; neu can chay moi ngay, dat lich bang Task Scheduler/Cron sau khi kiem thu.
- Khong mo endpoint thu thap cho public; chi chay management command tren server.
- Bo thu thap khong theo redirect va khong tai noi dung bai bao; chi doc RSS/Atom.
- Bao mat production: sua SECRET_KEY, DEBUG, ALLOWED_HOSTS, HTTPS, CORS/CSRF, xac thuc cac API atlas cu.
- Gioi han SSRF theo DNS kiem tra truoc ket noi la bao ve co ban, chua du cho moi mo hinh de doa; nen co egress firewall/allowlist.
