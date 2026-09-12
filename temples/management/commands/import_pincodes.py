import csv
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from temples.models import PincodeLocation


PINCODE_PATTERN = re.compile(r"^[0-9]{6}$")
BATCH_SIZE = 2000

REQUIRED_COLUMNS = {
    "circlename",
    "regionname",
    "divisionname",
    "officename",
    "pincode",
    "officetype",
    "delivery",
    "district",
    "statename",
    "latitude",
    "longitude",
}


def clean_value(row, column_name):
    return str(row.get(column_name) or "").strip()


def parse_coordinate(value):
    value = str(value or "").strip()

    if not value or value.upper() in {"NA", "N/A", "NULL", "NONE"}:
        return None

    try:
        return Decimal(value)
    except InvalidOperation:
        return None


class Command(BaseCommand):
    help = "Import India Post pincode CSV data into the database."

    def add_arguments(self, parser):
        parser.add_argument(
            "csv_path",
            type=str,
            help="Path of the All India Pincode CSV file.",
        )

        parser.add_argument(
            "--replace",
            action="store_true",
            help="Delete existing pincode records before importing.",
        )

    def handle(self, *args, **options):
        csv_path = Path(options["csv_path"]).expanduser().resolve()
        replace_existing = options["replace"]

        if not csv_path.exists():
            raise CommandError(
                f"CSV file not found: {csv_path}"
            )

        if not csv_path.is_file():
            raise CommandError(
                f"Given path is not a file: {csv_path}"
            )

        processed_count = 0
        skipped_count = 0
        batch = []

        try:
            with csv_path.open(
                mode="r",
                encoding="utf-8-sig",
                newline="",
            ) as csv_file:
                reader = csv.DictReader(csv_file)

                available_columns = set(reader.fieldnames or [])
                missing_columns = REQUIRED_COLUMNS - available_columns

                if missing_columns:
                    missing = ", ".join(sorted(missing_columns))
                    raise CommandError(
                        f"CSV columns missing: {missing}"
                    )

                with transaction.atomic():
                    if replace_existing:
                        deleted_count, _ = (
                            PincodeLocation.objects.all().delete()
                        )

                        self.stdout.write(
                            self.style.WARNING(
                                f"Deleted {deleted_count} old records."
                            )
                        )

                    for row in reader:
                        pincode = clean_value(row, "pincode")
                        office_name = clean_value(row, "officename")
                        district = clean_value(row, "district")
                        state = clean_value(row, "statename")

                        if (
                            not PINCODE_PATTERN.fullmatch(pincode)
                            or not office_name
                            or not district
                            or not state
                        ):
                            skipped_count += 1
                            continue

                        batch.append(
                            PincodeLocation(
                                circle_name=clean_value(
                                    row,
                                    "circlename",
                                ),
                                region_name=clean_value(
                                    row,
                                    "regionname",
                                ),
                                division_name=clean_value(
                                    row,
                                    "divisionname",
                                ),
                                office_name=office_name,
                                pincode=pincode,
                                office_type=clean_value(
                                    row,
                                    "officetype",
                                ),
                                delivery_status=clean_value(
                                    row,
                                    "delivery",
                                ),
                                district=district,
                                state=state,
                                latitude=parse_coordinate(
                                    row.get("latitude")
                                ),
                                longitude=parse_coordinate(
                                    row.get("longitude")
                                ),
                            )
                        )

                        processed_count += 1

                        if len(batch) >= BATCH_SIZE:
                            PincodeLocation.objects.bulk_create(
                                batch,
                                batch_size=BATCH_SIZE,
                                ignore_conflicts=True,
                            )
                            batch.clear()

                            self.stdout.write(
                                f"Processed {processed_count} records..."
                            )

                    if batch:
                        PincodeLocation.objects.bulk_create(
                            batch,
                            batch_size=BATCH_SIZE,
                            ignore_conflicts=True,
                        )

        except UnicodeDecodeError as error:
            raise CommandError(
                "CSV encoding invalid. UTF-8 CSV file use cheyyandi."
            ) from error

        except OSError as error:
            raise CommandError(
                f"CSV file read cheyyalekapoyanu: {error}"
            ) from error

        database_count = PincodeLocation.objects.count()

        self.stdout.write(
            self.style.SUCCESS(
                "\nPincode import completed successfully."
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Processed rows: {processed_count}"
            )
        )

        self.stdout.write(
            self.style.WARNING(
                f"Skipped rows: {skipped_count}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Database records: {database_count}"
            )
        )