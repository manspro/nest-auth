import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, User } from '@prisma/client';
import { genSalt, hashSync } from 'bcryptjs';
import { IJwtPayload } from '../auth/interfaces';

@Injectable()
export class UserService {
    constructor(private readonly prismaService: PrismaService) {}

    async save(user: Partial<User>) {
        const hashPassword = await this.hashPassword(user.password);

        return this.prismaService.user.create({
            data: {
                email: user.email,
                password: hashPassword,
                roles: ['USER'],
            },
        });
    }

    async findOne(idOrEmail: string) {
        return this.prismaService.user.findFirst({
            where: {
                OR: [{ id: idOrEmail }, { email: idOrEmail }],
            },
        });
    }

    async delete(id: string, user: IJwtPayload) {
        if (user.id !== id && !user.roles.includes(Role.ADMIN)) {
            throw new ForbiddenException();
        }
        return this.prismaService.user.delete({ where: { id }, select: { id: true } });
    }

    private async hashPassword(password: string) {
        return hashSync(password, await genSalt(10));
    }
}
