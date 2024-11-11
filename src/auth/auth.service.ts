import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  async validateUser(profile: any) {
    // Lógica para buscar o crear el usuario en la base de datos
    // Retorna el usuario o los datos que deseas.
    console.log(profile);
    return {
      email: profile.user.emails[0].value,
      name: profile.user.displayName,
    };
  }
}
