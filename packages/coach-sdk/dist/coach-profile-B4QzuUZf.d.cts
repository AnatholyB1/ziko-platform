import { z } from 'zod';

declare const ImportedProgramSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    goal: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        strength: "strength";
        hypertrophy: "hypertrophy";
        endurance: "endurance";
        weight_loss: "weight_loss";
        body_recomp: "body_recomp";
        hyrox: "hyrox";
        powerlifting: "powerlifting";
        general: "general";
        other: "other";
    }>>>;
    equipment: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    weeks: z.ZodArray<z.ZodObject<{
        week_number: z.ZodNumber;
        sessions: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            day_of_week: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            exercises: z.ZodArray<z.ZodObject<{
                exercise_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                name: z.ZodString;
                sets: z.ZodNumber;
                reps: z.ZodNumber;
                target_rpe: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
                target_rir: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
                rest_seconds: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
                notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
                confidence: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            }, z.core.$strict>>;
            notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strict>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strict>>;
    source: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        ai_import: "ai_import";
        manual: "manual";
        template_fork: "template_fork";
    }>>>;
    overall_confidence: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strict>;

declare const CoachClientLinkSchema: z.ZodObject<{
    id: z.ZodString;
    coach_id: z.ZodString;
    client_id: z.ZodString;
    expires_at: z.ZodNullable<z.ZodString>;
    revoked_at: z.ZodNullable<z.ZodString>;
    created_at: z.ZodString;
}, z.core.$strict>;

declare const CoachProfileSchema: z.ZodObject<{
    user_id: z.ZodString;
    display_name: z.ZodString;
    bio: z.ZodNullable<z.ZodString>;
    specialties: z.ZodArray<z.ZodString>;
    website: z.ZodNullable<z.ZodString>;
    photo_url: z.ZodNullable<z.ZodString>;
    kyc_status: z.ZodEnum<{
        pending: "pending";
        submitted: "submitted";
        verified: "verified";
        rejected: "rejected";
    }>;
    kyc_docs: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            other: "other";
            certification: "certification";
            id_document: "id_document";
        }>;
        url: z.ZodString;
        uploaded_at: z.ZodString;
        filename: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, z.core.$strict>;

export { CoachClientLinkSchema as C, ImportedProgramSchema as I, CoachProfileSchema as a };
