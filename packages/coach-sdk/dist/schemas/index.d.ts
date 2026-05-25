export { C as CoachClientLinkSchema, a as CoachProfileSchema, I as ImportedProgramSchema } from '../coach-profile-B4QzuUZf.js';
import { z } from 'zod';

declare const CoachInvitationSchema: z.ZodObject<{
    id: z.ZodString;
    coach_id: z.ZodString;
    code: z.ZodString;
    expires_at: z.ZodNullable<z.ZodString>;
    revoked_at: z.ZodNullable<z.ZodString>;
    use_count: z.ZodNumber;
    max_uses: z.ZodNumber;
    created_at: z.ZodString;
}, z.core.$strip>;
type CoachInvitation = z.infer<typeof CoachInvitationSchema>;
declare const ComputedStatusSchema: z.ZodEnum<{
    active: "active";
    used: "used";
    expired: "expired";
    revoked: "revoked";
}>;
type ComputedStatus = z.infer<typeof ComputedStatusSchema>;
declare function computeInvitationStatus(row: Pick<CoachInvitation, 'expires_at' | 'revoked_at' | 'use_count' | 'max_uses'>, now?: Date): ComputedStatus;
declare const CoachInvitationWithStatusSchema: z.ZodObject<{
    id: z.ZodString;
    coach_id: z.ZodString;
    code: z.ZodString;
    expires_at: z.ZodNullable<z.ZodString>;
    revoked_at: z.ZodNullable<z.ZodString>;
    use_count: z.ZodNumber;
    max_uses: z.ZodNumber;
    created_at: z.ZodString;
    status: z.ZodEnum<{
        active: "active";
        used: "used";
        expired: "expired";
        revoked: "revoked";
    }>;
}, z.core.$strip>;
type CoachInvitationWithStatus = z.infer<typeof CoachInvitationWithStatusSchema>;

declare const CoachPreviewPayloadSchema: z.ZodObject<{
    coach_id: z.ZodString;
    display_name: z.ZodString;
    bio: z.ZodNullable<z.ZodString>;
    specialties: z.ZodNullable<z.ZodArray<z.ZodString>>;
    photo_signed_url: z.ZodNullable<z.ZodString>;
    kyc_status: z.ZodNullable<z.ZodEnum<{
        pending: "pending";
        submitted: "submitted";
        verified: "verified";
        rejected: "rejected";
    }>>;
}, z.core.$strip>;
type CoachPreviewPayload = z.infer<typeof CoachPreviewPayloadSchema>;
declare const CoachLinkPreviewSuccessSchema: z.ZodObject<{
    ok: z.ZodLiteral<true>;
    error_code: z.ZodNull;
    preview: z.ZodObject<{
        coach_id: z.ZodString;
        display_name: z.ZodString;
        bio: z.ZodNullable<z.ZodString>;
        specialties: z.ZodNullable<z.ZodArray<z.ZodString>>;
        photo_signed_url: z.ZodNullable<z.ZodString>;
        kyc_status: z.ZodNullable<z.ZodEnum<{
            pending: "pending";
            submitted: "submitted";
            verified: "verified";
            rejected: "rejected";
        }>>;
    }, z.core.$strip>;
}, z.core.$strip>;
declare const CoachLinkPreviewErrorSchema: z.ZodObject<{
    ok: z.ZodLiteral<false>;
    error_code: z.ZodLiteral<"INVALID_OR_EXPIRED">;
    preview: z.ZodNull;
}, z.core.$strip>;
declare const CoachLinkPreviewSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    ok: z.ZodLiteral<true>;
    error_code: z.ZodNull;
    preview: z.ZodObject<{
        coach_id: z.ZodString;
        display_name: z.ZodString;
        bio: z.ZodNullable<z.ZodString>;
        specialties: z.ZodNullable<z.ZodArray<z.ZodString>>;
        photo_signed_url: z.ZodNullable<z.ZodString>;
        kyc_status: z.ZodNullable<z.ZodEnum<{
            pending: "pending";
            submitted: "submitted";
            verified: "verified";
            rejected: "rejected";
        }>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    ok: z.ZodLiteral<false>;
    error_code: z.ZodLiteral<"INVALID_OR_EXPIRED">;
    preview: z.ZodNull;
}, z.core.$strip>], "ok">;
type CoachLinkPreview = z.infer<typeof CoachLinkPreviewSchema>;
declare const CoachLinkRedeemSuccessSchema: z.ZodObject<{
    ok: z.ZodLiteral<true>;
    error_code: z.ZodNull;
    link: z.ZodObject<{
        id: z.ZodString;
        coach_id: z.ZodString;
        client_id: z.ZodString;
        created_at: z.ZodString;
    }, z.core.$strip>;
    preview: z.ZodObject<{
        coach_id: z.ZodString;
        display_name: z.ZodString;
        bio: z.ZodNullable<z.ZodString>;
        specialties: z.ZodNullable<z.ZodArray<z.ZodString>>;
        photo_signed_url: z.ZodNullable<z.ZodString>;
        kyc_status: z.ZodNullable<z.ZodEnum<{
            pending: "pending";
            submitted: "submitted";
            verified: "verified";
            rejected: "rejected";
        }>>;
    }, z.core.$strip>;
}, z.core.$strip>;
declare const CoachLinkRedeemErrorSchema: z.ZodObject<{
    ok: z.ZodLiteral<false>;
    error_code: z.ZodLiteral<"INVALID_OR_EXPIRED">;
    link: z.ZodNull;
    preview: z.ZodNull;
}, z.core.$strip>;
declare const CoachLinkRedeemSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    ok: z.ZodLiteral<true>;
    error_code: z.ZodNull;
    link: z.ZodObject<{
        id: z.ZodString;
        coach_id: z.ZodString;
        client_id: z.ZodString;
        created_at: z.ZodString;
    }, z.core.$strip>;
    preview: z.ZodObject<{
        coach_id: z.ZodString;
        display_name: z.ZodString;
        bio: z.ZodNullable<z.ZodString>;
        specialties: z.ZodNullable<z.ZodArray<z.ZodString>>;
        photo_signed_url: z.ZodNullable<z.ZodString>;
        kyc_status: z.ZodNullable<z.ZodEnum<{
            pending: "pending";
            submitted: "submitted";
            verified: "verified";
            rejected: "rejected";
        }>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    ok: z.ZodLiteral<false>;
    error_code: z.ZodLiteral<"INVALID_OR_EXPIRED">;
    link: z.ZodNull;
    preview: z.ZodNull;
}, z.core.$strip>], "ok">;
type CoachLinkRedeem = z.infer<typeof CoachLinkRedeemSchema>;

declare const ClientSummarySchema: z.ZodObject<{
    sessions_this_week: z.ZodNumber;
    habits_pct: z.ZodNullable<z.ZodNumber>;
    last_workout_at: z.ZodNullable<z.ZodString>;
    latest_weight_kg: z.ZodNullable<z.ZodNumber>;
    mood_delta: z.ZodNullable<z.ZodNumber>;
    mood_prev_avg: z.ZodNullable<z.ZodNumber>;
    mood_curr_avg: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
type ClientSummary = z.infer<typeof ClientSummarySchema>;

declare const CoachClientTagSchema: z.ZodObject<{
    id: z.ZodString;
    coach_id: z.ZodString;
    client_id: z.ZodString;
    tag: z.ZodString;
    created_at: z.ZodString;
}, z.core.$strip>;
type CoachClientTag = z.infer<typeof CoachClientTagSchema>;

declare const CoachClientNoteSchema: z.ZodObject<{
    id: z.ZodString;
    coach_id: z.ZodString;
    client_id: z.ZodString;
    content: z.ZodString;
    updated_at: z.ZodString;
}, z.core.$strip>;
type CoachClientNote = z.infer<typeof CoachClientNoteSchema>;

declare const ProgramExerciseSchema: z.ZodObject<{
    exercise_id: z.ZodNullable<z.ZodString>;
    exercise_name: z.ZodString;
    sets: z.ZodNumber;
    reps: z.ZodNullable<z.ZodNumber>;
    duration_seconds: z.ZodNullable<z.ZodNumber>;
    target_rpe: z.ZodNullable<z.ZodNumber>;
    target_rir: z.ZodNullable<z.ZodNumber>;
    rest_seconds: z.ZodNullable<z.ZodNumber>;
    notes: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
type ProgramExercise = z.infer<typeof ProgramExerciseSchema>;

declare const ProgramSessionSchema: z.ZodObject<{
    session_id: z.ZodString;
    session_name: z.ZodString;
    day_of_week: z.ZodNumber;
    exercises: z.ZodArray<z.ZodObject<{
        exercise_id: z.ZodNullable<z.ZodString>;
        exercise_name: z.ZodString;
        sets: z.ZodNumber;
        reps: z.ZodNullable<z.ZodNumber>;
        duration_seconds: z.ZodNullable<z.ZodNumber>;
        target_rpe: z.ZodNullable<z.ZodNumber>;
        target_rir: z.ZodNullable<z.ZodNumber>;
        rest_seconds: z.ZodNullable<z.ZodNumber>;
        notes: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
type ProgramSession = z.infer<typeof ProgramSessionSchema>;

declare const ProgramWeekSchema: z.ZodObject<{
    week_number: z.ZodNumber;
    sessions: z.ZodArray<z.ZodObject<{
        session_id: z.ZodString;
        session_name: z.ZodString;
        day_of_week: z.ZodNumber;
        exercises: z.ZodArray<z.ZodObject<{
            exercise_id: z.ZodNullable<z.ZodString>;
            exercise_name: z.ZodString;
            sets: z.ZodNumber;
            reps: z.ZodNullable<z.ZodNumber>;
            duration_seconds: z.ZodNullable<z.ZodNumber>;
            target_rpe: z.ZodNullable<z.ZodNumber>;
            target_rir: z.ZodNullable<z.ZodNumber>;
            rest_seconds: z.ZodNullable<z.ZodNumber>;
            notes: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
type ProgramWeek = z.infer<typeof ProgramWeekSchema>;

export { type ClientSummary, ClientSummarySchema, type CoachClientNote, CoachClientNoteSchema, type CoachClientTag, CoachClientTagSchema, type CoachInvitation, CoachInvitationSchema, type CoachInvitationWithStatus, CoachInvitationWithStatusSchema, type CoachLinkPreview, CoachLinkPreviewErrorSchema, CoachLinkPreviewSchema, CoachLinkPreviewSuccessSchema, type CoachLinkRedeem, CoachLinkRedeemErrorSchema, CoachLinkRedeemSchema, CoachLinkRedeemSuccessSchema, type CoachPreviewPayload, CoachPreviewPayloadSchema, type ComputedStatus, ComputedStatusSchema, type ProgramExercise, ProgramExerciseSchema, type ProgramSession, ProgramSessionSchema, type ProgramWeek, ProgramWeekSchema, computeInvitationStatus };
