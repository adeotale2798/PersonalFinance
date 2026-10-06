import pytest

from server import validate_production_config


@pytest.fixture
def production_config():
    return {
        "APP_ENV": "production",
        "JWT_SECRET": "a" * 48,
        "ADMIN_PASSWORD": "Different-Strong-Password-2026",
        "CORS_ORIGINS": "https://finance.example.com,https://admin.example.com",
        "MONGO_URL": "mongodb+srv://cluster.example.com/nivara",
    }


def test_production_config_accepts_explicit_secure_settings(production_config):
    assert validate_production_config(production_config) is None


def test_production_config_rejects_development_defaults(production_config):
    production_config.update({
        "JWT_SECRET": "replace-this-with-a-long-random-secret",
        "ADMIN_PASSWORD": "Nivara@2026",
        "CORS_ORIGINS": "*",
        "MONGO_URL": "mongodb://127.0.0.1:27017",
        "NIVARA_E2E_DEMO": "true",
    })

    with pytest.raises(RuntimeError) as error:
        validate_production_config(production_config)

    message = str(error.value)
    assert "JWT_SECRET" in message
    assert "ADMIN_PASSWORD" in message
    assert "CORS_ORIGINS" in message
    assert "MONGO_URL" in message
    assert "NIVARA_E2E_DEMO" in message


@pytest.mark.parametrize(
    "origin",
    ["http://finance.example.com", "https://finance.example.com/path", "https://finance.example.com?x=1"],
)
def test_production_config_rejects_non_origin_cors_values(production_config, origin):
    production_config["CORS_ORIGINS"] = origin

    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        validate_production_config(production_config)


def test_production_config_accepts_explicit_tls_for_standard_mongodb_uri(production_config):
    production_config["MONGO_URL"] = "mongodb://db.example.com/nivara?tls=true"

    assert validate_production_config(production_config) is None


def test_nonproduction_config_keeps_local_development_defaults():
    assert validate_production_config({"APP_ENV": "development"}) is None
