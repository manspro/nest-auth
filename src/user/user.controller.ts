import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post()
    async createUser(@Body() dto: any) {
        return this.userService.save(dto);
    }

    @Get(':idOrEmail')
    async findOneUser(@Param('idOrEmail') idOrEmail: string) {
        return this.userService.findOne(idOrEmail);
    }

    @Delete(':id')
    async deleteUser(@Param('id', ParseUUIDPipe) id: string) {
        return this.userService.delete(id);
    }
}
