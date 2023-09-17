import { Provider, Role, User } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class UserResponse implements User {
    id: string;

    email: string;

    @Exclude()
    password: string;

    @Exclude()
    provider: Provider;

    @Exclude()
    isBlocked: boolean;

    roles: Role[];

    createdAt: Date;

    updatedAt: Date;

    constructor(user: User) {
        Object.assign(this, user);
    }
}
