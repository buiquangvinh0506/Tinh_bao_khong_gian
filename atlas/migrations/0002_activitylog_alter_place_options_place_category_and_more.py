from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('atlas', '0001_initial')]
    operations = [
        migrations.CreateModel(name='ActivityLog', fields=[
            ('id',models.BigAutoField(primary_key=True,serialize=False)),
            ('action',models.CharField(choices=[('created','Tao dia diem'),('updated','Cap nhat dia diem'),('deleted','Xoa dia diem'),('imported','Nhap GeoJSON')],max_length=12)),
            ('place_id_ref',models.PositiveBigIntegerField(blank=True,null=True)),
            ('place_name',models.CharField(max_length=160)),
            ('detail',models.CharField(blank=True,max_length=300)),
            ('timestamp',models.DateTimeField(auto_now_add=True)),
        ],options={'ordering':['-timestamp','-id']}),
        migrations.AlterModelOptions(name='place',options={'ordering':['-created_at']}),
        migrations.AddField(model_name='place',name='category',field=models.CharField(choices=[('civic','Cong trinh cong cong'),('heritage','Di san va lich su'),('transport','Giao thong'),('environment','Moi truong'),('research','Diem nghien cuu'),('other','Khac')],default='research',max_length=20)),
        migrations.AddField(model_name='place',name='source_url',field=models.URLField(blank=True,max_length=500)),
        migrations.AddField(model_name='place',name='updated_at',field=models.DateTimeField(auto_now=True,blank=True,null=True)),
    ]
