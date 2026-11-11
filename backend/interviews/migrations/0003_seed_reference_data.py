from django.db import migrations

LEVELS = [
    ("junior", "Junior", "Основы и применение на простых примерах", 1),
    ("middle", "Middle", "Сравнение подходов и обоснование выбора", 2),
]

DIRECTIONS = [
    ("backend_python", "Backend-разработка (Python)", "ООП, SQL, REST API", 1),
]


def seed(apps, schema_editor):
    Level = apps.get_model("interviews", "Level")
    Direction = apps.get_model("interviews", "Direction")
    for code, name, description, sort_order in LEVELS:
        Level.objects.update_or_create(
            code=code,
            defaults={"name": name, "description": description, "sort_order": sort_order},
        )
    for code, name, description, sort_order in DIRECTIONS:
        Direction.objects.update_or_create(
            code=code,
            defaults={
                "name": name,
                "description": description,
                "is_active": True,
                "sort_order": sort_order,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("interviews", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
