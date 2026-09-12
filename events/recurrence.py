from datetime import timedelta

from django.db.models import Max, Q
from django.utils import timezone

from .models import TempleEvent
from .event_state import compute_event_state

# Ento kారణం valla last_date corrupt/chాలా వెనుక ఉన్నా, ఒకే
# request lo infinite/chాలా ఎక్కువ rows create అవ్వకుండా safety cap.
MAX_BACKFILL_PER_SERIES = 90

# "ఈరోజు వరకు" matrame create చేస్తే, ఈరోజుది Completed అయిన
# వెంటనే "Upcoming" tab lo ఏమీ కనపడదు — repటి occurrence inకా
# create avvaledu kābatti. Kāబట్టి "ఈరోజు నుండి inకో LOOKAHEAD_DAYS
# రోజుల వరకు" ముందుగానే create చేస్తాం — ఎప్పుడూ ఒక buffer of
# upcoming occurrences ready గా ఉండేలా.
LOOKAHEAD_DAYS = 7


def _next_occurrence_date(last_date, recurrence):
    if recurrence == "daily":
        return last_date + timedelta(days=1)

    if recurrence == "weekly":
        return last_date + timedelta(days=7)

    return None


def ensure_recurring_occurrences_generated(temple=None):
    """
    Recurring event "templates" (recurrence != 'none' and
    recurrence_parent is None) ni chూసి, ఈరోజు నుండి
    `LOOKAHEAD_DAYS` రోజుల వరకు miss ayina occurrences ni
    automatic గా (ముందుగానే) create చేస్తుంది.

    Idi prathi events-list API call (public devotee-facing mariyu
    admin temple-events list) modati lo call avutundi — separate
    cron/Windows Task Scheduler avasaram లేకుండా, "ఎవరైనా app
    తెరిచినప్పుడు" next occurrence ఇప్పటికే "Upcoming" గా
    ready గా ఉండేలా చేస్తుంది.

    `temple` pettite aa temple ki matrame restrict avutundi (admin
    per-temple view kosam); None aithe అన్ని temples ki (public
    devotee events list kosam).
    """
    today = timezone.localdate()
    horizon = today + timedelta(days=LOOKAHEAD_DAYS)

    templates = TempleEvent.objects.filter(
        recurrence__in=["daily", "weekly"],
        recurrence_parent__isnull=True,
        status="published",
    )

    if temple is not None:
        templates = templates.filter(temple=temple)

    for template in templates:
        last_date = TempleEvent.objects.filter(
            Q(pk=template.pk) | Q(recurrence_parent=template)
        ).aggregate(Max("event_date"))["event_date__max"]

        if last_date is None:
            last_date = template.event_date

        next_date = _next_occurrence_date(last_date, template.recurrence)
        generated_count = 0

        while (
            next_date is not None
            and next_date <= horizon
            and generated_count < MAX_BACKFILL_PER_SERIES
        ):
            TempleEvent.objects.create(
                temple=template.temple,
                title=template.title,
                description=template.description,
                event_type=template.event_type,
                event_date=next_date,
                start_time=template.start_time,
                end_time=template.end_time,
                image=template.image,
                status=template.status,
                # NOTE: recurrence ni "none" ki bదులు template
                # yokka actual type (daily/weekly) ni copy chేస్తాం
                # — lekapothe ee occurrence "next/soonest" గా
                # represent chేసినప్పుడు, badge "Never" ani తప్పుగా
                # చూపిస్తుంది (recurrence_parent__isnull=True filter
                # వల్ల idi generation logic ni ఎలాంటి ప్రభావితం
                # చేయదు — occurrences ఎప్పటికీ templates గా
                # treat avvavu, recurrence field ఏమైనా సరే).
                recurrence=template.recurrence,
                recurrence_parent=template,
                created_by=template.created_by,
            )

            next_date = _next_occurrence_date(next_date, template.recurrence)
            generated_count += 1


def collapse_recurring_series(events):
    """
    Devotee-facing (public) event list lo, oka recurring series
    (daily/weekly) yokka andarū "Completed కాని" occurrences ni
    okesari chూపిస్తే chాలా repetitive గా, confusing గా అనిపిస్తుంది
    (ఉదా. 7 "Daily Pooja" cards ఒకదాని కింద ఒకటి).

    Idi prathi series ki: Completed occurrences అన్నీ యథావిధిగా
    ఉంచుతుంది (history కోసం), kanీ Completed కాని (Upcoming/Ongoing)
    వాటిల్లో matrame **soonest okkati** ఉంచి, migిలినవి ee response
    nunchi hide చేస్తుంది. Admin-facing views ee function వాడవు —
    admin ki అన్ని occurrences kanapadali (individual గా edit/cancel
    చేయగలగడానికి).

    `events` already event_date/start_time ascending order lo
    undali (queryset already .order_by("event_date","start_time")
    వాడుతుంది కాబట్టి idi safe).
    """
    seen_series_ids = set()
    result = []

    for event in events:
        is_part_of_series = (
            event.recurrence != "none"
            or event.recurrence_parent_id is not None
        )

        if not is_part_of_series:
            result.append(event)
            continue

        if compute_event_state(event) == "completed":
            result.append(event)
            continue

        series_key = event.recurrence_parent_id or event.id

        if series_key in seen_series_ids:
            continue

        seen_series_ids.add(series_key)
        result.append(event)

    return result