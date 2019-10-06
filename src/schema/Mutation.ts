import { ContextParameters } from 'graphql-yoga/dist/types';
import { mutationType, arg } from 'nexus';
import { Photon, User } from '@generated/photon';
import { UserSignupInput } from './UserSignupInput';
import { UserLoginInput } from './UserLoginInput';
import { hashPassword, comparePasswords } from '../utils/password';
import generateToken from '../utils/generateToken';
import getUserId from '../utils/getUserId';

const Mutation = mutationType({
    definition(t) {
        t.field('signup', {
            type: 'AuthPayload',
            args: {
                data: UserSignupInput.asArg({ required: true }),
            },
            resolve: async (parent, { data }, { photon }: { photon: Photon }) => {
                try {
                    const user = await photon.users.findOne({ where: { email: data.email } });
                    if (user) {
                        throw new Error('Email taken');
                    }
                } catch (err) {
                    const message = err.message || '';
                    if (message.includes('Email taken')) {
                        throw err;
                    }
                    if (!message.includes('Record does not exist')) {
                        console.error(err);
                        throw new Error('Uknown error');
                    }
                }

                const password = await hashPassword(data.password as string);
                const newUser = await photon.users.create({ data: { ...data, password } });

                return {
                    user: newUser,
                    token: generateToken(newUser.id),
                };
            },
        });

        t.field('login', {
            type: 'AuthPayload',
            args: {
                data: arg({ type: UserLoginInput, required: true }),
            },
            resolve: async (parent, { data }, { photon }: { photon: Photon }) => {
                const { email, password } = data;
                let user: User;

                try {
                    user = await photon.users.findOne({ where: { email } });
                } catch (err) {
                    const message = err.message || '';
                    if (message.includes('Record does not exist')) {
                        throw new Error('Invalid credentials');
                    } else {
                        console.error(err);
                        throw new Error('Uknown error');
                    }
                }
                if (!(await comparePasswords(password, user.password))) {
                    throw new Error('Invalid credentials');
                }

                return {
                    user,
                    token: generateToken(user.id),
                };
            },
        });

        t.crud.updateOneUser({ alias: 'updateUser' });
        t.modify('updateUser', {
            resolve: async (
                parent,
                { data },
                { photon, ctxParams }: { photon: Photon; ctxParams: ContextParameters },
            ) => {
                const userId = getUserId(ctxParams);

                try {
                    await photon.users.findOne({ where: { id: userId } });
                } catch (err) {
                    const message = err.message || '';
                    if (message.includes('Record does not exist')) {
                        throw new Error('User not found');
                    } else {
                        throw new Error('Uknown error');
                    }
                }

                if (data.password) {
                    data.password = await hashPassword(data.password);
                }

                return photon.users.update({ data, where: { id: userId } });
            },
        });

        t.crud.deleteOneUser({ alias: 'deleteUser' });
        t.modify('deleteUser', {
            resolve: async (parent, args, { photon, ctxParams }: { photon: Photon; ctxParams: ContextParameters }) => {
                const userId = getUserId(ctxParams);

                try {
                    await photon.users.findOne({ where: { id: userId } });
                } catch (err) {
                    const message = err.message || '';
                    if (message.includes('Record does not exist')) {
                        throw new Error('User not found');
                    } else {
                        throw new Error('Uknown error');
                    }
                }

                return photon.users.delete({ where: { id: userId } });
            },
        });
    },
});

export { Mutation };
