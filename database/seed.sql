-- Seed data for Mini E-Commerce Backend

-- Admin account
-- Email: admin@example.com | Password: Admin123!
-- Password hash generated with bcrypt (10 rounds)
INSERT INTO users (email, password_hash, role)
VALUES ('admin@example.com', '$2b$10$2nLl/dAxy3NGOjtTCrk7IebFS16dWo0Xv8NZVcHtPGux6sz8epGI6', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO products (name, description, price, stock) VALUES
    ('Gaming Laptop', 'High performance laptop for gaming and productivity', 3999.99, 50),
    ('Mechanical Keyboard', 'RGB backlit mechanical keyboard', 249.99, 100),
    ('Gaming Mouse', 'High precision gaming mouse', 129.99, 150),
    ('Monitor', '27 inch 144Hz gaming monitor', 899.99, 40),
    ('Headset', 'Surround sound gaming headset', 199.99, 80)
ON CONFLICT DO NOTHING;
