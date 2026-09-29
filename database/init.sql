-- ============================================================
-- BeePiMart Database Schema
-- Hệ thống bán hàng tiện lợi với 3 role: customer, admin, shipper
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Bảng USERS - Lưu tài khoản người dùng
-- Có 3 role: customer (khách), admin (quản trị), shipper (giao hàng)
-- Password được hash bằng bcrypt, KHÔNG lưu plain text
-- ============================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'customer' CHECK (
        role IN (
            'customer',
            'admin',
            'shipper'
        )
    ),
    full_name VARCHAR(100),
    phone VARCHAR(15),
    address TEXT,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Bảng AUDIT_LOGS - Ghi lại mọi hành động quan trọng
-- Dùng cho bảo mật: biết ai làm gì, khi nào, từ IP nào
-- ============================================================
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users (id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50),
    entity_id INT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_logs (user_id);

CREATE INDEX idx_audit_action ON audit_logs (action);

CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);

-- ============================================================
-- Bảng CATEGORIES - Danh mục sản phẩm
-- ============================================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Bảng PRODUCTS - Sản phẩm
-- is_fragile: đánh dấu hàng dễ vỡ cần giao cẩn thận
-- ============================================================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category_id INT REFERENCES categories (id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url TEXT,
    is_featured BOOLEAN DEFAULT FALSE,
    is_fragile BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Bảng SHIPPERS - Nhân viên giao hàng
-- total_points: điểm tích lũy (+10 điểm mỗi đơn giao thành công)
-- ============================================================
CREATE TABLE shippers (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    vehicle VARCHAR(50),
    license_plate VARCHAR(20),
    area VARCHAR(100),
    total_points INT DEFAULT 0,
    total_deliveries INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Bảng ORDERS - Đơn hàng
-- status: Chờ xử lý → Đã xác nhận → Chờ lấy hàng → Đang giao → Hoàn thành
-- Có thể hủy ở các trạng thái trước "Đang giao"
-- ============================================================
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users (id) ON DELETE CASCADE,
    shipper_id INT REFERENCES shippers (id) ON DELETE SET NULL,
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(50) DEFAULT 'Chờ xử lý' CHECK (
        status IN (
            'Chờ xử lý',
            'Đã xác nhận',
            'Chờ lấy hàng',
            'Đang giao',
            'Hoàn thành',
            'Đã hủy'
        )
    ),
    shipping_address TEXT NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'COD' CHECK (
        payment_method IN ('COD', 'BANK', 'WALLET')
    ),
    is_paid BOOLEAN DEFAULT FALSE,
    is_fragile BOOLEAN DEFAULT FALSE,
    notes TEXT,
    cancel_reason TEXT,
    assigned_at TIMESTAMP,
    delivered_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Bảng ORDER_ITEMS - Chi tiết từng món trong đơn
-- Lưu product_name và price tại thời điểm mua
-- để giữ lịch sử ngay cả khi sản phẩm đổi giá/tên
-- ============================================================
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders (id) ON DELETE CASCADE,
    product_id INT REFERENCES products (id) ON DELETE SET NULL,
    product_name VARCHAR(150) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0)
);

-- ============================================================
-- Bảng SLIDERS - Banner khuyến mãi trang chủ
-- Admin có thể upload ảnh, sửa tiêu đề, ẩn/hiện
-- ============================================================
CREATE TABLE sliders (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    link_url VARCHAR(255) DEFAULT '#',
    button_text VARCHAR(100) DEFAULT 'Xem Thêm',
    tag_text VARCHAR(100),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Bảng SHIPPER_HISTORY - Lịch sử giao hàng của shipper
-- Dùng để tính điểm và xem lại lịch sử
-- ============================================================
CREATE TABLE shipper_history (
    id SERIAL PRIMARY KEY,
    shipper_id INT REFERENCES shippers (id) ON DELETE CASCADE,
    order_id INT REFERENCES orders (id) ON DELETE CASCADE,
    points_earned INT DEFAULT 0,
    delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- ============================================================
-- Tạo INDEX để tăng tốc truy vấn
-- ============================================================
CREATE INDEX idx_users_username ON users (username);

CREATE INDEX idx_users_email ON users (email);

CREATE INDEX idx_users_role ON users (role);

CREATE INDEX idx_products_name ON products (name);

CREATE INDEX idx_products_category ON products (category_id);

CREATE INDEX idx_products_active ON products (is_active);

CREATE INDEX idx_orders_user ON orders (user_id);

CREATE INDEX idx_orders_shipper ON orders (shipper_id);

CREATE INDEX idx_orders_status ON orders (status);

CREATE INDEX idx_orders_created ON orders (created_at DESC);

CREATE INDEX idx_sliders_order ON sliders (display_order, id);

CREATE INDEX idx_shippers_user ON shippers (user_id);

CREATE INDEX idx_shipper_history_shipper ON shipper_history (shipper_id);

-- ============================================================
-- Trigger tự động cập nhật updated_at khi UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA - Dữ liệu mẫu
-- Password gốc được hash bằng bcrypt cost 10
-- admin123 -> hash bên dưới
-- user123  -> hash bên dưới
-- ship123  -> hash bên dưới
-- ============================================================

INSERT INTO
    users (
        username,
        email,
        password_hash,
        role,
        full_name,
        phone,
        address
    )
VALUES (
        'admin',
        'admin@beepimart.vn',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        'admin',
        'Tổng Quản Trị',
        '0901234567',
        'Quận 1, TP.HCM'
    ),
    (
        'customer',
        'khachhang@gmail.com',
        '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfgqwSup7i7yNXxVWpWrHX8QNWJZ2p6K',
        'customer',
        'Nguyễn Văn A',
        '0987654321',
        '123 Đường Láng, Đống Đa, Hà Nội'
    ),
    (
        'customer2',
        'lethib@gmail.com',
        '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfgqwSup7i7yNXxVWpWrHX8QNWJZ2p6K',
        'customer',
        'Lê Thị B',
        '0911223344',
        '456 Điện Biên Phủ, Bình Thạnh, TP.HCM'
    ),
    (
        'shipper1',
        'shipper1@beepimart.vn',
        '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa',
        'shipper',
        'Trần Văn Giao',
        '0911111111',
        'Quận 1, TP.HCM'
    ),
    (
        'shipper2',
        'shipper2@beepimart.vn',
        '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa',
        'shipper',
        'Nguyễn Thị Vận',
        '0922222222',
        'Quận 3, TP.HCM'
    );

INSERT INTO
    shippers (
        user_id,
        full_name,
        phone,
        vehicle,
        license_plate,
        area
    )
VALUES (
        (
            SELECT id
            FROM users
            WHERE
                username = 'shipper1'
        ),
        'Trần Văn Giao',
        '0911111111',
        'Xe máy',
        '59-X1 234.56',
        'Quận 1, 3, 5'
    ),
    (
        (
            SELECT id
            FROM users
            WHERE
                username = 'shipper2'
        ),
        'Nguyễn Thị Vận',
        '0922222222',
        'Xe máy',
        '59-X2 345.67',
        'Quận 7, Nhà Bè'
    );

INSERT INTO
    categories (id, name, slug, icon)
VALUES (
        1,
        'Đồ uống và Cà phê',
        'do-uong-ca-phe',
        '🥤'
    ),
    (
        2,
        'Thức ăn nhanh',
        'thuc-an-nhanh',
        '🍱'
    ),
    (
        3,
        'Bánh kẹo và Snack',
        'banh-keo-snack',
        '🍿'
    ),
    (
        4,
        'Mì gói và Đóng hộp',
        'mi-goi-dong-hop',
        '🍜'
    ),
    (
        5,
        'Kem và Tráng miệng',
        'kem-trang-mieng',
        '🍦'
    ),
    (
        6,
        'Chăm sóc cá nhân',
        'cham-soc-ca-nhan',
        '🧴'
    );

INSERT INTO
    products (
        category_id,
        name,
        description,
        price,
        stock,
        image_url,
        is_featured,
        is_fragile
    )
VALUES (
        1,
        'Cà phê Sữa Đá BeePi',
        'Cà phê phin nguyên chất đậm đà kết hợp sữa đặc',
        29000,
        150,
        '',
        true,
        false
    ),
    (
        1,
        'Trà Sữa Matcha Trân Châu',
        'Trà xanh Nhật Bản thơm mát hòa quyện sữa tươi',
        35000,
        80,
        '',
        false,
        false
    ),
    (
        1,
        'Nước Năng Lượng Monster 355ml',
        'Nước uống tăng lực nhập khẩu',
        32000,
        200,
        '',
        true,
        false
    ),
    (
        1,
        'Nước suối Aquafina 500ml',
        'Nước uống đóng chai tinh khiết',
        6000,
        500,
        '',
        false,
        false
    ),
    (
        1,
        'Sữa tươi Vinamilk 180ml',
        'Sữa tươi nguyên chất 100 phần trăm',
        9000,
        300,
        '',
        false,
        false
    ),
    (
        2,
        'Cơm nắm Cá hồi',
        'Cơm gạo Nhật dẻo bọc rong biển',
        25000,
        45,
        '',
        true,
        false
    ),
    (
        2,
        'Mì trộn Trứng muối Siêu Cay',
        'Mì sợi dai trộn sốt trứng muối',
        35000,
        40,
        '',
        true,
        false
    ),
    (
        2,
        'Bánh mì Que Hải Phòng',
        'Bánh mì que giòn rụm nhân pate',
        15000,
        60,
        '',
        false,
        false
    ),
    (
        2,
        'Sandwich Gà Nướng',
        'Sandwich kẹp thịt gà nướng phô mai',
        28000,
        35,
        '',
        false,
        false
    ),
    (
        3,
        'Snack Khoai tây Lay''s',
        'Khoai tây cắt lát giòn rụm vị rong biển',
        15000,
        250,
        '',
        false,
        true
    ),
    (
        3,
        'Bánh Quy Choco-Pie Lotte',
        'Bánh xốp phủ socola nhân marshmallow',
        38000,
        120,
        '',
        false,
        true
    ),
    (
        3,
        'Kẹo dẻo Haribo 80g',
        'Kẹo dẻo hình gấu hương trái cây',
        24000,
        180,
        '',
        false,
        false
    ),
    (
        4,
        'Mì Ly Hảo Hảo Tôm Chua Cay',
        'Mì ly thương hiệu quốc dân',
        10000,
        400,
        '',
        false,
        false
    ),
    (
        4,
        'Mì gà cay Samyang 140g',
        'Mì cay khô hot hit từ Hàn Quốc',
        30000,
        150,
        '',
        false,
        false
    ),
    (
        5,
        'Kem Ốc Quế Merino',
        'Kem vani đan xen sốt socola ngọt ngào',
        18000,
        90,
        '',
        false,
        false
    ),
    (
        5,
        'Kem Cornetto Dâu Tây',
        'Dâu tây chua ngọt kết hợp kem phô mai',
        22000,
        85,
        '',
        false,
        false
    ),
    (
        6,
        'Khăn giấy ướt Bobby 100 tờ',
        'Khăn ướt mềm mại an toàn cho da',
        38000,
        140,
        '',
        false,
        false
    ),
    (
        6,
        'Nước rửa tay Lifebuoy 180g',
        'Diệt sạch 99.9 phần trăm vi khuẩn gây hại',
        42000,
        110,
        '',
        false,
        true
    ),
    (
        6,
        'Pin AA Energizer 2 viên',
        'Pin kiềm dòng điện ổn định',
        25000,
        160,
        '',
        false,
        false
    ),
    (
        6,
        'Áo mưa tiện lợi siêu dai',
        'Áo mưa trùm gọn nhẹ chống thấm',
        10000,
        300,
        '',
        false,
        false
    );

INSERT INTO
    sliders (
        title,
        description,
        image_url,
        link_url,
        button_text,
        tag_text,
        display_order,
        is_active
    )
VALUES (
        'Giảm 30 phần trăm Đồ Uống',
        'Áp dụng cho tất cả nước ngọt, trà xanh, cà phê đóng chai',
        'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=1600',
        '#',
        'Mua Ngay',
        'KHUYẾN MÃI HOT',
        1,
        TRUE
    ),
    (
        'Miễn Phí Vận Chuyển',
        'Cho đơn hàng từ 99.000đ trên toàn quốc',
        'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1600',
        '#',
        'Xem Thêm',
        'FREESHIP',
        2,
        TRUE
    ),
    (
        'Combo Mì và Nước',
        'Chỉ từ 25.000đ - Tiết kiệm đến 40 phần trăm',
        'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=1600',
        '#',
        'Khám Phá',
        'COMBO TIẾT KIỆM',
        3,
        TRUE
    );