UPDATE users
SET
    password_hash = '$2a$10$PePJ65nH8Ytyfg6zNGGi.9hXEu/yFdUw9RqulR5TvLT8gujfBsre'
WHERE
    username = 'admin';

UPDATE users
SET
    password_hash = '$2a$10$Wx0XpNw/jJj21W7PXWn.1.JZvc5cWzrMX/WnhMRPS32LUjJZg'
WHERE
    username = 'customer';

UPDATE users
SET
    password_hash = '$2a$10$LTh9OARs7YLFIDBFt/drO.cVHjLqcMEBQVkO/bJahkH3XXpfnA2z6'
WHERE
    username = 'customer2';

UPDATE users
SET
    password_hash = '$2a$10$7kHZiV63hutLjE.JhkPd5eJ1fbycEUaiIODALryT3jo2E5iKzMhge'
WHERE
    username = 'shipper1';

UPDATE users
SET
    password_hash = '$2a$10$icBbVkMi1tq7Gv3YcbbukLkb00d/zubL.bg0eB0vqW4u6Rr9Knk'
WHERE
    username = 'shipper2';