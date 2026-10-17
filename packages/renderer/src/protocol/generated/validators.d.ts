type Validator = ((data: unknown) => boolean) & { errors?: { instancePath: string; message?: string }[] | null };
export const validateNode: Validator;
export const validateIntegrationSchema: Validator;
