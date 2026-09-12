from django.db.models import Count
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import EventComment, EventLike, TempleEvent
from .recurrence import (
    collapse_recurring_series,
    ensure_recurring_occurrences_generated,
)
from temples.models import Temple, TempleMember

from .models import TempleEvent
from .serializers import EventCommentSerializer, TempleEventSerializer

CONTENT_MANAGER_ROLES = {
    "owner",
    "manager",
}


def get_temple_membership(user, temple_id):
    return (
        TempleMember.objects
        .select_related(
            "temple",
            "temple__workspace",
            "temple__workspace__owner",
            "user",
        )
        .filter(
            temple_id=temple_id,
            temple__is_verified=True,
            user=user,
        )
        .first()
    )


def get_temple_access(user, temple_id):
    if user.is_superuser:
        temple = (
            Temple.objects
            .select_related(
                "workspace",
                "workspace__owner",
            )
            .filter(pk=temple_id)
            .first()
        )

        return temple, None

    membership = get_temple_membership(
        user,
        temple_id,
    )

    if membership is None:
        return None, None

    return membership.temple, membership


def get_event_visibility_filter(temple):
    if temple.workspace_id is None:
        return {
            "temple_id": temple.id,
        }

    return {
        "temple__workspace_id": temple.workspace_id,
    }


def get_user_memberships_by_temple(user, temple):
    if user.is_superuser:
        return {}

    memberships = (
        TempleMember.objects
        .select_related(
            "temple",
            "user",
        )
        .filter(
            temple__is_verified=True,
            user=user,
        )
    )

    if temple.workspace_id is None:
        memberships = memberships.filter(
            temple_id=temple.id,
        )
    else:
        memberships = memberships.filter(
            temple__workspace_id=temple.workspace_id,
        )

    return {
        membership.temple_id: membership
        for membership in memberships
    }


def get_serializer_context(
    request,
    temple,
    membership=None,
    memberships_by_temple_id=None,
):
    if memberships_by_temple_id is None:
        memberships_by_temple_id = {}

    workspace_owner_id = None

    if temple.workspace_id is not None:
        workspace_owner_id = temple.workspace.owner_id

    return {
        "request": request,
        "membership": membership,
        "memberships_by_temple_id": (
            memberships_by_temple_id
        ),
        "workspace_owner_id": workspace_owner_id,
    }


def can_manage_event(
    user,
    membership,
    event,
):
    if user.is_superuser:
        return True

    if (
        event.temple.workspace_id is not None
        and event.temple.workspace.owner_id == user.id
    ):
        return True

    if event.created_by_id == user.id:
        return True

    return (
        membership is not None
        and membership.temple_id == event.temple_id
        and membership.role in CONTENT_MANAGER_ROLES
    )


def temple_access_denied_response():
    return Response(
        {
            "success": False,
            "message": (
                "Temple dorakaledhu leda "
                "meeku ee temple access ledhu."
            ),
        },
        status=status.HTTP_404_NOT_FOUND,
    )


def event_not_found_response():
    return Response(
        {
            "success": False,
            "message": "Event dorakaledhu.",
        },
        status=status.HTTP_404_NOT_FOUND,
    )


def event_permission_denied_response():
    return Response(
        {
            "success": False,
            "message": (
                "Ee event-ni edit/delete "
                "cheyyadaniki permission ledhu."
            ),
        },
        status=status.HTTP_403_FORBIDDEN,
    )


class TempleEventListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_access(self, request, temple_id):
        return get_temple_access(
            request.user,
            temple_id,
        )

    def get(self, request, temple_id):
        temple, membership = self.get_access(
            request,
            temple_id,
        )

        if temple is None:
            return temple_access_denied_response()

        # Ee temple ki recurring event templates ఏమైనా ఉంటే, ఈరోజు
        # వరకు miss ayina occurrences ni ఇక్కడే backfill చేస్తుంది.
        ensure_recurring_occurrences_generated(temple=temple)

        events = (
            TempleEvent.objects
            .filter(
                **get_event_visibility_filter(
                    temple,
                )
            )
            .select_related(
                "created_by",
                "temple",
                "temple__workspace",
                "temple__workspace__owner",
            )
            .order_by(
                "event_date",
                "start_time",
                "-created_at",
            )
        )

        memberships_by_temple_id = (
            get_user_memberships_by_temple(
                request.user,
                temple,
            )
        )

        serializer = TempleEventSerializer(
            events,
            many=True,
            context=get_serializer_context(
                request,
                temple,
                membership=membership,
                memberships_by_temple_id=(
                    memberships_by_temple_id
                ),
            ),
        )

        return Response(
            {
                "success": True,
                "can_create": True,
                "workspace_id": temple.workspace_id,
                "events": serializer.data,
                "count": events.count(),
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, temple_id):
        temple, membership = self.get_access(
            request,
            temple_id,
        )

        if temple is None:
            return temple_access_denied_response()

        serializer = TempleEventSerializer(
            data=request.data,
            context=get_serializer_context(
                request,
                temple,
                membership=membership,
                memberships_by_temple_id={
                    temple.id: membership,
                },
            ),
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": (
                        "Event details correct chesi "
                        "malli save cheyyandi."
                    ),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        event = serializer.save(
            temple=temple,
            created_by=request.user,
        )

        # Event create chేసిన వెంటనే (recurring aithe), వేరే GET
        # request kosam wait cheyakunda ఇక్కడే buffer fill చేస్తాం —
        # admin ki వెంటనే "ఇది pని చేస్తుంది" అని కనపడుతుంది.
        if event.recurrence in ("daily", "weekly"):
            ensure_recurring_occurrences_generated(temple=temple)

        response_serializer = TempleEventSerializer(
            event,
            context=get_serializer_context(
                request,
                temple,
                membership=membership,
                memberships_by_temple_id={
                    temple.id: membership,
                },
            ),
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Event successfully create ayyindi."
                ),
                "event": response_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class TempleEventDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_context(
        self,
        request,
        temple_id,
        event_id,
    ):
        temple, access_membership = get_temple_access(
            request.user,
            temple_id,
        )

        if temple is None:
            return None, None, temple_access_denied_response()

        event = (
            TempleEvent.objects
            .select_related(
                "created_by",
                "temple",
                "temple__workspace",
                "temple__workspace__owner",
            )
            .filter(
                pk=event_id,
                **get_event_visibility_filter(
                    temple,
                ),
            )
            .first()
        )

        if event is None:
            return (
                access_membership,
                None,
                event_not_found_response(),
            )

        membership = get_temple_membership(
            request.user,
            event.temple_id,
        )

        return membership, event, None

    def get(
        self,
        request,
        temple_id,
        event_id,
    ):
        membership, event, error_response = (
            self.get_context(
                request,
                temple_id,
                event_id,
            )
        )

        if error_response is not None:
            return error_response

        serializer = TempleEventSerializer(
            event,
            context=get_serializer_context(
                request,
                event.temple,
                membership=membership,
                memberships_by_temple_id={
                    event.temple_id: membership,
                },
            ),
        )

        return Response(
            {
                "success": True,
                "event": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def patch(
        self,
        request,
        temple_id,
        event_id,
    ):
        membership, event, error_response = (
            self.get_context(
                request,
                temple_id,
                event_id,
            )
        )

        if error_response is not None:
            return error_response

        if not can_manage_event(
            request.user,
            membership,
            event,
        ):
            return event_permission_denied_response()

        serializer = TempleEventSerializer(
            event,
            data=request.data,
            partial=True,
            context=get_serializer_context(
                request,
                event.temple,
                membership=membership,
                memberships_by_temple_id={
                    event.temple_id: membership,
                },
            ),
        )

        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "message": (
                        "Event details correct chesi "
                        "malli save cheyyandi."
                    ),
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated_event = serializer.save()

        # Edit chేసినప్పుడు recurrence ni 'none' nunchi daily/weekly
        # ki మార్చినా, వెంటనే buffer fill అవ్వాలి — create view లో
        # laగే ఇక్కడ కూడా.
        if updated_event.recurrence in ("daily", "weekly"):
            ensure_recurring_occurrences_generated(
                temple=updated_event.temple
            )

        response_serializer = TempleEventSerializer(
            updated_event,
            context=get_serializer_context(
                request,
                updated_event.temple,
                membership=membership,
                memberships_by_temple_id={
                    updated_event.temple_id: membership,
                },
            ),
        )

        return Response(
            {
                "success": True,
                "message": (
                    "Event successfully update ayyindi."
                ),
                "event": response_serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def delete(
        self,
        request,
        temple_id,
        event_id,
    ):
        membership, event, error_response = (
            self.get_context(
                request,
                temple_id,
                event_id,
            )
        )

        if error_response is not None:
            return error_response

        if not can_manage_event(
            request.user,
            membership,
            event,
        ):
            return event_permission_denied_response()

        is_part_of_recurring_series = (
            event.recurrence != "none"
            or event.recurrence_parent_id is not None
        )

        if is_part_of_recurring_series:
            # Hard-delete చేస్తే, backend కి "ఈ date ki event
            # ఉద్దేశపూర్వకంగా cancel చేసారు" ani తెలుసుకునే మార్గం
            # ఉండదు — తర్వాతి buffer-generation call లో idి "ఇంకా
            # fill కాలేదు" అనుకుని తిరిగి create చేసేస్తుంది (idి
            # farthest-date occurrence ki matrame కనపడే bug).
            # Kాబట్టి recurring series lo ఏదైనా event ni "delete"
            # chేస్తే, row ni DB lo ఉంచి status='rejected' గా matrame
            # mark chేస్తాం — idి devotee app ki కనపడదు (already
            # status="published" filter undi), kanీ Max(event_date)
            # watermark ki correct గా count అవుతుంది, కాబట్టి delete
            # ఏ position లో ఉన్నా శాశ్వతంగా ఉండిపోతుంది.
            event.status = "rejected"
            event.save(update_fields=["status"])
        else:
            event.delete()

        return Response(
            {
                "success": True,
                "message": (
                    "Event successfully delete ayyindi."
                ),
            },
            status=status.HTTP_200_OK,
        )


class EventLikeToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, event_id):
        event = TempleEvent.objects.filter(pk=event_id).first()

        if event is None:
            return event_not_found_response()

        like, created = EventLike.objects.get_or_create(
            event=event,
            user=request.user,
        )

        if not created:
            like.delete()
            liked = False
        else:
            liked = True

        return Response(
            {
                "success": True,
                "liked": liked,
                "like_count": event.likes.count(),
            },
            status=status.HTTP_200_OK,
        )



class PublicEventListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Ee call (devotees prati sāri Events tab tెరిచినప్పుడు) e
        # global గా అన్ని temples యొక్క recurring event templates ni
        # backfill చేస్తుంది — idi lazy generation యొక్క main trigger.
        ensure_recurring_occurrences_generated()

        events = (
            TempleEvent.objects
            .filter(
                status="published",
                temple__is_verified=True,
            )
            .select_related("temple", "created_by")
            # like_count/comment_count ni per-row query lekunda
            # single query lo annotate chestunnam (N+1 fix).
            # distinct=True: rendu reverse-FK (likes, comments)
            # okesari annotate chesthe join rows duplicate avvakunda.
            .annotate(
                like_count_annotated=Count(
                    "likes", distinct=True
                ),
                comment_count_annotated=Count(
                    "comments", distinct=True
                ),
            )
            .order_by("event_date", "start_time")
        )

        # Devotee-facing view kābatti, prathi recurring series ki
        # Completed కాని occurrences లో soonest okkati matrame
        # ఉంచుతాం — admin panel లో idi apply avvadu (akkada anni
        # occurrences kanapadali).
        events = collapse_recurring_series(events)

        # is_liked kosam prati event ki వేరే query veyakunda,
        # login అయిన user like chesina event ids anni okate
        # query lo tీసుకుని set గా pass chేస్తున్నాం.
        liked_event_ids = set()

        if request.user.is_authenticated:
            liked_event_ids = set(
                EventLike.objects
                .filter(user=request.user, event__in=events)
                .values_list("event_id", flat=True)
            )

        serializer = TempleEventSerializer(
            events,
            many=True,
            context={
                "request": request,
                "liked_event_ids": liked_event_ids,
            },
        )

        return Response(
            {
                "success": True,
                "events": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class EventCommentListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request, event_id):
        comments = (
            EventComment.objects
            .filter(event_id=event_id)
            .select_related("user")
        )
        serializer = EventCommentSerializer(comments, many=True)
        return Response(
            {"success": True, "comments": serializer.data},
            status=status.HTTP_200_OK,
        )

    def post(self, request, event_id):
        event = TempleEvent.objects.filter(pk=event_id).first()

        if event is None:
            return event_not_found_response()

        text = (request.data.get("text") or "").strip()

        if not text:
            return Response(
                {"text": ["Comment ఖాళీగా ఉండకూడదు."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comment = EventComment.objects.create(
            event=event,
            user=request.user,
            text=text,
        )

        serializer = EventCommentSerializer(comment)
        return Response(
            {"success": True, "comment": serializer.data},
            status=status.HTTP_201_CREATED,
        )