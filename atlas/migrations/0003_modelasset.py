from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('atlas','0002_activitylog_alter_place_options_place_category_and_more')]
    operations = [
        migrations.CreateModel(
            name='ModelAsset',
            fields=[
                ('id',models.BigAutoField(primary_key=True,serialize=False)),
                ('name',models.CharField(max_length=160)),
                ('file',models.FileField(upload_to='geoint_models/%Y/%m/')),
                ('longitude',models.FloatField()),
                ('latitude',models.FloatField()),
                ('height',models.FloatField(default=0)),
                ('scale',models.FloatField(default=1)),
                ('heading',models.FloatField(default=0)),
                ('source_url',models.URLField(blank=True,max_length=500)),
                ('created_at',models.DateTimeField(auto_now_add=True)),
            ],options={'ordering':['-created_at']},
        ),
    ]
