<?php

namespace Tests\Feature\Auth;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;
use Tests\TestCase;

class PasswordValidationTest extends TestCase
{
    public function test_password_shorter_than_eight_characters_is_rejected(): void
    {
        $validator = Validator::make(
            ['password' => 'abc1234'],
            ['password' => ['required', Password::defaults()]],
        );

        $this->assertTrue($validator->fails());
    }

    public function test_password_with_eight_characters_is_accepted(): void
    {
        $validator = Validator::make(
            ['password' => 'abc12345'],
            ['password' => ['required', Password::defaults()]],
        );

        $this->assertFalse($validator->fails());
    }
}
