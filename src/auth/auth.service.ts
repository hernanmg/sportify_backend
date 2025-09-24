import { HttpService } from '@nestjs/axios';
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { lastValueFrom } from 'rxjs';
import { UserResponseDto } from 'src/users/dtos/userResponseDto';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';

type AuthInput = { email: string; password: string };
type AuthResult = {
  accessToken: string;
  userId: number;
  userName: string;
  role: string;
};
@Injectable()
export class AuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly jwtService: JwtService,
    private readonly userService: UsersService,
  ) {}
  async validateUser(profile: any) {
    // Lógica para buscar o crear el usuario en la base de datos
    // Retorna el usuario o los datos que deseas.
    console.log(profile);
    return {
      email: profile.user.emails[0].value,
      name: profile.user.displayName,
    };
  }

  async validateGoogleToken(googleToken: string): Promise<AuthResult> {
    const url = `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${googleToken}`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      const { id, email, name } = response.data;

      console.log('Google user data:', { id, email, name });

      if (!id || !email) {
        throw new UnauthorizedException('Invalid Google token');
      }

      // Buscar o crear usuario en la base de datos
      console.log('Buscando usuario por email:', email);
      console.log('UserService instance:', this.userService);
      
      let user;
      try {
        user = await this.userService.findByEmail(email);
        console.log('Usuario encontrado:', user);
      } catch (error) {
        console.error('Error al buscar usuario:', error);
        throw new UnauthorizedException('Database error: ' + error.message);
      }
      
      if (!user) {
        // Crear nuevo usuario con datos de Google
        user = await this.userService.createGoogleUser({
          email,
          username: name || email.split('@')[0],
          googleId: id,
        });
      } else {
        // Actualizar googleId si no existe
        if (!user.googleId) {
          await this.userService.updateGoogleId(user.id, id);
        }
      }

      // Generar JWT con tu lógica
      const userDto: UserResponseDto = {
        id: user.id,
        name: user.username,
        userName: user.username,
        accessToken: '',
        role: user.userRoles?.[0]?.role?.name || 'user',
      };

      return this.singIn(userDto);
    } catch (error) {
      throw new UnauthorizedException('Invalid Google token: ' + error.message);
    }
  }

  async validateFacebookToken(facebookToken: string) {
    const url = `https://graph.facebook.com/me?access_token=${facebookToken}`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      const { id, name, email } = response.data;

      if (!id) {
        throw new UnauthorizedException('Invalid Facebook token');
      }

      // Aquí podrías hacer verificaciones adicionales o almacenar el usuario en tu base de datos

      const payload = { facebookId: id, name, email };
      return this.jwtService.sign(payload);
    } catch (error) {
      throw new UnauthorizedException('Invalid Facebook token' + error);
    }
  }
  async validateUserLogin(input: AuthInput): Promise<UserResponseDto | null> {
    const user = await this.userService.findByEmail(input.email);
    
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Usuario sin contraseña configurada');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    // Verificar que el usuario tenga al menos un rol asignado
    if (!user.userRoles || user.userRoles.length === 0) {
      // Si no tiene roles, asignar rol 'guest' por defecto
      await this.userService.assignRoleToUser(user.id, 5); // guest = role_id 5
      
      // Recargar el usuario con los roles actualizados
      const updatedUser = await this.userService.findByEmail(input.email);
      return {
        id: updatedUser.id,
        name: updatedUser.username,
        userName: updatedUser.username,
        accessToken: '',
        role: 'guest',
      };
    }

    // Obtener el primer rol del usuario
    const userRole = user.userRoles[0];
    if (!userRole || !userRole.role) {
      throw new UnauthorizedException('Error en la configuración de roles del usuario');
    }

    return {
      id: user.id,
      name: user.username,
      userName: user.username,
      accessToken: '',
      role: userRole.role.name,
    };
  }

  async authenticate(input: AuthInput): Promise<AuthResult> {
    const user = await this.validateUserLogin(input);

    if (!user) {
      throw new UnauthorizedException('Usuario o password incorrectos.');
    }

    return this.singIn(user);
  }

  async singIn(user: UserResponseDto): Promise<AuthResult> {
    // const tokenPayload = {
    //   sub: user.id,
    //   userName: user.userName,
    // };

    const tokens = await this.generateTokens(user);
    return {
      ...tokens,
      userId: user.id,
      userName: user.userName,
      role: user.role,
    };
    // const accessToken = await this.jwtService.signAsync(tokenPayload);

    // return { accessToken, userName: user.userName, userId: user.id };
  }

  async generateTokens(
    user: UserResponseDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenPayload = {
      sub: user.id,
      userName: user.userName,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(tokenPayload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(tokenPayload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '20m',
    });

    // Guardar el `refreshToken` en la base de datos
    // await this.userService.update(user.id, { refreshToken });

    return { accessToken, refreshToken };
  }
  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // Aquí podrías validar el token contra una lista negra si implementas esta lógica

      const user = await this.userService.findOne(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      return this.generateTokens({
        id: user.id,
        name: user.username,
        userName: user.username,
        accessToken: '',
        role: user.userRoles[0].role.name,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  async register(input: { 
    email: string; 
    password: string; 
    firstName?: string; 
    lastName?: string; 
  }): Promise<AuthResult> {
    const { email, password, firstName, lastName } = input;

    // Validaciones básicas
    if (!email || !password) {
      throw new BadRequestException('Email y contraseña son requeridos');
    }

    if (password.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }

    // Verificar si el email ya existe
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el usuario
    const userData = {
      email,
      username: firstName ? `${firstName} ${lastName || ''}`.trim() : email.split('@')[0],
      passwordHash: hashedPassword,
      firstName,
      lastName,
      estadoRegistro: 'active',
      emailVerified: false, // Podrías implementar verificación por email
      isActive: true,
      profileCompletion: 20, // Email y nombre básico = 20%
    };

    const newUser = await this.userService.create(userData);

    try {
      // Asignar rol por defecto 'guest' a usuarios nuevos
      await this.userService.assignRoleToUser(newUser.id, 5); // guest = role_id 5
    } catch (roleError) {
      console.warn('Error asignando rol por defecto:', roleError.message);
      // Continuar aunque falle la asignación de rol
    }

    // Generar tokens y retornar
    const userDto: UserResponseDto = {
      id: newUser.id,
      name: newUser.username,
      userName: newUser.username,
      accessToken: '',
      role: 'guest', // Rol por defecto para nuevos usuarios
    };

    return this.singIn(userDto);
  }
}
