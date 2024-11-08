import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async validateUser(profile: any): Promise<any> {
    console.log('Validando el usuario con el perfil:', profile); // Verifica que el perfil esté llegando
    const user = {
      email: profile.emails[0].value,
      name: profile.displayName,
      googleId: profile.id,
    };
    // Aquí deberías validar el usuario en tu base de datos o crear uno nuevo
    return user;
  }
}
