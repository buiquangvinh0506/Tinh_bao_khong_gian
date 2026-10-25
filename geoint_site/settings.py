from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = 'development-only-change-before-deployment'
DEBUG = True
ALLOWED_HOSTS = ['127.0.0.1', 'localhost']
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'atlas',
    'intelligence',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'geoint_site.urls'
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True,
              'OPTIONS': {'context_processors': [
                  'django.template.context_processors.debug', 'django.template.context_processors.request',
                  'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'geoint_site.wsgi.application'
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('GEOINT_DB_NAME', 'GeoOSINT'),
        'USER': os.environ.get('GEOINT_DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('GEOINT_DB_PASSWORD', 'vinhbui123'),
        'HOST': os.environ.get('GEOINT_DB_HOST', '127.0.0.1'),
        'PORT': os.environ.get('GEOINT_DB_PORT', '5433'),
    }
}
AUTH_PASSWORD_VALIDATORS = []
LANGUAGE_CODE = 'vi'
TIME_ZONE = 'Asia/Ho_Chi_Minh'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Development-only local uploads. Do not expose MEDIA_ROOT in production without auth.
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
# Authentication
LOGIN_URL = "/admin/login/"
LOGIN_REDIRECT_URL = "/api/intelligence/dashboard/"
LOGOUT_REDIRECT_URL = "/admin/login/"
