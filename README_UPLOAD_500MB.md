# GEOINT OS — Nâng cấp thanh tab và tải GLB 500 MiB

- Thanh tab: giữ chuột trái và kéo ngang, hoặc Shift+wheel (tùy trình duyệt), phím mũi tên khi focus. Nhấp bình thường vẫn đổi tab.
- Model Factory: chọn nhiều GLB, hiển thị tên, dung lượng từng tệp, số lượng và tổng dung lượng. Gửi từng tệp riêng; không yêu cầu nhiều tệp trong một request.
- Giới hạn: 500 MiB cho **mỗi tệp** tại cả giao diện và API Django. Tổng nhiều tệp có thể lớn hơn 500 MiB, phụ thuộc ổ cứng.
- Dung lượng 500 MiB không phải RAM hay VRAM được cấp thêm. GLB lớn có thể tải và dựng rất chậm.
- Sao lưu trước khi ghi đè. Không cần migration. Không ghi đè `config.local.js` hoặc `.venv`.
- Chỉ dùng trong môi trường local đáng tin cậy; API upload hiện không có xác thực riêng, không công khai server lên Internet.
- Nghiệm thu: kéo thanh tab, chọn 2 GLB, xem thông báo, tải thử, kiểm tra danh sách sau tải lại.
