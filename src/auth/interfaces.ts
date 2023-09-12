import { Token } from '@prisma/client';

export interface ITokens {
    accessToken: string;
    refreshToken: Token;
}

export interface IJwtPayload {
    id: string;
    email: string;
    roles: string[];
}
