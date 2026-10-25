# GEOINT Vinh - khoi dong tren Windows PowerShell

## A. Khoi dong du an Django dang co

1. Sao luu thu muc du an va database. Mo PowerShell trong thu muc chua `manage.py` (vi du duong dan tren may ban co the khac).
2. Kiem tra: `Get-ChildItem manage.py` - xac nhan dung thu muc.
3. Kich hoat moi truong ao **neu da co**: `.\.venv\Scripts\Activate.ps1` hoac `.\venv\Scripts\Activate.ps1`. Neu bi chan execution policy, dung truc tiep `.\.venv\Scripts\python.exe` thay cho `python`, khong can doi policy.
4. `python manage.py check` - kiem tra cau hinh Django. Neu bao loi PostgreSQL, can khoi dong dung database da cau hinh; khong tu y chuyen sang SQLite.
5. `python manage.py runserver 127.0.0.1:8000` - chay may chu phat trien, chi truy cap tren may cuc bo.
6. Mo `http://127.0.0.1:8000/` (neu trang chu co cau hinh). Nhan `Ctrl+C` de dung.

## B. Cai bo OSINT addon (lam mot lan)

1. Giai nen goi ZIP ra mot thu muc tam.
2. Chep thu muc `intelligence` vao **cung cap voi `manage.py` va `atlas`**. Neu da cai Phase 1, sao luu truoc khi ghi de thu muc `intelligence`.
3. Trong `geoint_site/settings.py`, them `'intelligence',` vao `INSTALLED_APPS` neu chua co.
4. Trong `geoint_site/urls.py`, them `from django.urls import include, path` neu chua co, va them `path('api/intelligence/', include('intelligence.urls')),` vao `urlpatterns` neu chua co.
5. `python manage.py makemigrations intelligence` - tao migration cho bang OSINT (bao gom truong `kind`).
6. `python manage.py migrate` - cap nhat database da cau hinh; **sao luu truoc**.
7. `python manage.py test intelligence` - chay kiem thu (can database test phu hop).
8. `python manage.py createsuperuser` - tao tai khoan admin neu chua co.
9. `python manage.py runserver 127.0.0.1:8000` - chay Django.
10. Vao `http://127.0.0.1:8000/admin/`, them `Source` (RSS hoac HTML public), chi bat `enabled` cho nguon ban duoc phep truy cap.
11. Mo terminal PowerShell khac cung thu muc va moi truong: `python manage.py collect_osint` - thu thap thu cong.
12. Sau khi dang nhap, mo `http://127.0.0.1:8000/api/intelligence/inbox/` - xem JSON cac tin thu thap.

## C. Luu y

- Chua co AI LLM phan tich, giao dien inbox rieng, lich chay hang ngay hay connector mang xa hoi/PDF.
- HTML collector chi doc mot trang cong khai da duoc dang ky; khong tu dong crawl lien ket; noi dung thay doi se cap nhat ban ghi hien tai, **chua co lich su phien ban**.
- Nguon HTML va RSS chi chap nhan HTTPS, chan redirect va IP khong cong khai o muc co ban. Kiem tra robots.txt, dieu khoan nguon, va gioi han tan suat; nen co egress firewall neu trien khai tren server.
- Khong dua token Cesium ion, mat khau hoac Django SECRET_KEY vao chat hay git.
- `runserver` chi de phat trien, khong dung lam may chu production.
