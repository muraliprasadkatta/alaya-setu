from django.utils import timezone


def compute_event_state(event):
    """
    event_date/start_time/end_time ni ఇప్పటి real time తో compare
    చేసి 'upcoming' / 'ongoing' / 'completed' return చేస్తుంది.

    Idi DB లో store చేయబడదు — prathi సారి live గా calculate
    అవుతుంది. Serializer (`TempleEventSerializer`) mariyu views
    (recurring-series collapse logic) రెండూ ఇదే function వాడతాయి,
    kాబట్టి "completed" అనే నిర్వచనం ఎప్పుడూ ఒకేలా ఉంటుంది.
    """
    now = timezone.now()

    if timezone.is_aware(now):
        now = timezone.localtime(now)

    today = now.date()
    current_time = now.time().replace(tzinfo=None)

    if event.event_date > today:
        return "upcoming"

    if event.event_date < today:
        return "completed"

    if event.start_time is not None and current_time < event.start_time:
        return "upcoming"

    if event.end_time is not None and current_time >= event.end_time:
        return "completed"

    return "ongoing"