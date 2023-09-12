import { Role, User } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class UserResponse implements User {
    createdAt: Date;
    email: string;
    id: string;

    @Exclude()
    password: string;
    roles: Role[];
    updatedAt: Date;

    constructor(user: User) {
        Object.assign(this, user);
    }
}
