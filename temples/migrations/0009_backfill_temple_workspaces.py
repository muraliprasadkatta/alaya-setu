from django.db import migrations


def backfill_temple_workspaces(apps, schema_editor):
    Temple = apps.get_model(
        "temples",
        "Temple",
    )
    TempleMember = apps.get_model(
        "temples",
        "TempleMember",
    )
    TempleWorkspace = apps.get_model(
        "temples",
        "TempleWorkspace",
    )

    database_alias = schema_editor.connection.alias

    temples = (
        Temple.objects
        .using(database_alias)
        .filter(workspace__isnull=True)
        .order_by("id")
    )

    for temple in temples.iterator():
        owner_membership = (
            TempleMember.objects
            .using(database_alias)
            .filter(
                temple_id=temple.id,
                role="owner",
            )
            .order_by(
                "created_at",
                "id",
            )
            .first()
        )

        owner_id = (
            owner_membership.user_id
            if owner_membership is not None
            else temple.created_by_id
        )

        if owner_id is None:
            continue

        workspace, _ = (
            TempleWorkspace.objects
            .using(database_alias)
            .get_or_create(owner_id=owner_id)
        )

        (
            Temple.objects
            .using(database_alias)
            .filter(
                pk=temple.id,
                workspace__isnull=True,
            )
            .update(workspace_id=workspace.id)
        )


class Migration(migrations.Migration):

    dependencies = [
        (
            "temples",
            "0008_templeworkspace_temple_workspace",
        ),
    ]

    operations = [
        migrations.RunPython(
            backfill_temple_workspaces,
            migrations.RunPython.noop,
        ),
    ]