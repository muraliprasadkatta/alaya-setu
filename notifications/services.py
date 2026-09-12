from .models import Notification


def create_notification(
    *,
    recipient,
    notification_type,
    title,
    message,
    event_key,
    temple=None,
    reference_type="",
    reference_id=None,
    action_data=None,
    web_action_url="",
):
    if recipient is None:
        return None

    notification, _ = Notification.objects.get_or_create(
        event_key=event_key,
        defaults={
            "recipient": recipient,
            "temple": temple,
            "notification_type": notification_type,
            "title": title,
            "message": message,
            "reference_type": reference_type,
            "reference_id": reference_id,
            "action_data": action_data or {},
            "web_action_url": web_action_url,
        },
    )

    return notification


def notify_temple_request_approved(temple_request):
    approved_temple = temple_request.approved_temple

    if approved_temple is not None:
        web_action_url = (
            f"/temples/{approved_temple.id}/manage"
        )

        action_data = {
            "action": "open_temple_management",
            "temple_id": approved_temple.id,
            "request_id": temple_request.id,
        }
    else:
        web_action_url = "/temple-admin-dashboard"

        action_data = {
            "action": "open_temple_request",
            "request_id": temple_request.id,
        }

    return create_notification(
        recipient=temple_request.submitted_by,
        temple=approved_temple,
        notification_type="temple_request_approved",
        title="Temple request approved",
        message=(
            f'Your request for "{temple_request.temple_name}" '
            "has been approved. You can now manage this temple."
        ),
        reference_type="temple_request",
        reference_id=temple_request.id,
        action_data=action_data,
        web_action_url=web_action_url,
        event_key=(
            f"temple_request:{temple_request.id}:approved"
        ),
    )


def notify_temple_request_rejected(temple_request):
    rejection_reason = (
        temple_request.rejection_reason.strip()
        or "No rejection reason was provided."
    )

    related_temple = temple_request.existing_temple

    return create_notification(
        recipient=temple_request.submitted_by,
        temple=related_temple,
        notification_type="temple_request_rejected",
        title="Temple request rejected",
        message=(
            f'Your request for "{temple_request.temple_name}" '
            f"was rejected. Reason: {rejection_reason}"
        ),
        reference_type="temple_request",
        reference_id=temple_request.id,
        action_data={
            "action": "open_temple_request",
            "request_id": temple_request.id,
            "status": "rejected",
        },
        web_action_url="/temple-admin-dashboard",
        event_key=(
            f"temple_request:{temple_request.id}:rejected"
        ),
    )